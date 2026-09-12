'use client';

import { ArrowUp, MessageCircle, MessageCircleOff, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ConciergeCharacter } from '@/components/ConciergeCharacter';
import { api, ApiError } from '@/lib/api';

/**
 * The floating concierge, backed by the RAG agent in agent/.
 *
 * Two things here are deliberate rather than decorative:
 *
 *  - It reads as a concierge, not as a search tool. The agent is grounded in
 *    the hotel's own document and cannot invent a policy, price or timing, but
 *    none of that machinery is narrated to the guest: no "from the document",
 *    no section citations, and a miss offers reception rather than reporting a
 *    failed lookup. The `origin` and `sources` fields still come back on every
 *    reply, so the grounding stays auditable from the API itself.
 *  - Only the last few turns are sent back as history. The agent uses them
 *    solely to resolve a terse follow-up ("and the spa?"), so a longer tail
 *    would cost bandwidth and buy nothing.
 */

const HISTORY_TURNS = 6;

const GREETING = {
  role: 'assistant',
  content:
    "Good day, and welcome to The Meridian Grand Mumbai. I'm Aarav. Ask me about " +
    'our policies, rooms and facilities, and I can check live room availability too.',
  suggestions: [
    'What time is check-in?',
    'Which room suits 4 guests?',
    'Any rooms free this weekend?',
    'What is the cancellation policy?',
  ],
};

/**
 * Badge copy per `origin` value returned by the agent.
 *
 * Only the live-data origins are surfaced, and only because "these are real
 * rooms, checked just now" is reassuring to a guest. Nothing here tells them
 * an answer was looked up in a document: a guest is talking to a concierge,
 * not watching a search engine work. The agent still returns `origin` and
 * `sources` on every reply, so the grounding stays auditable from the API and
 * from the staff-only /api/chat/search endpoint.
 */
const ORIGIN_LABEL = {
  live: { text: 'Checked just now', tone: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  'live+document': {
    text: 'Checked just now',
    tone: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
};

/**
 * The agent writes plain text, using "- " for lists. Rendering those as a real
 * list keeps a four-clause cancellation policy readable.
 *
 * Lines are grouped in the order they arrive rather than collected by kind: an
 * availability answer closes with "Check-in is 2:00 PM" *after* its list, and
 * gathering all the prose together would quietly hoist that above the rooms.
 */
function AnswerBody({ text }) {
  const blocks = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const bullet = line.trimStart().startsWith('- ');
    const current = blocks[blocks.length - 1];
    if (current && current.bullet === bullet) current.lines.push(line);
    else blocks.push({ bullet, lines: [line] });
  }

  return blocks.map((block, i) =>
    block.bullet ? (
      <ul key={i} className={i > 0 ? 'mt-2 space-y-1.5' : 'space-y-1.5'}>
        {block.lines.map((line, j) => (
          <li key={j} className="flex gap-2">
            <span aria-hidden className="mt-[0.45rem] size-1 shrink-0 rounded-full bg-sky-500" />
            <span>{line.trimStart().slice(2)}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p key={i} className={i > 0 ? 'mt-2 whitespace-pre-line' : 'whitespace-pre-line'}>
        {block.lines.join('\n')}
      </p>
    )
  );
}

/** Sign-in and registration are single-task screens; nothing floats over them. */
const HIDDEN_ON = ['/login', '/register'];

export function ChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  // 'idle' | 'thinking' | 'speaking' - drives the character's expression.
  const [mood, setMood] = useState('idle');

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const launcherRef = useRef(null);
  const speakTimer = useRef(null);
  const abortRef = useRef(null);

  // Pin to the newest message. `block: 'nearest'` keeps the page itself still.
  useEffect(() => {
    listRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, pending]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Esc closes from anywhere in the panel, and returns focus to the launcher.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        launcherRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  // An in-flight request outliving the component would set state on unmount.
  useEffect(
    () => () => {
      abortRef.current?.abort();
      clearTimeout(speakTimer.current);
    },
    []
  );

  const send = useCallback(
    async (text) => {
      const message = text.trim();
      if (!message || pending) return;

      setInput('');
      setPending(true);
      setMood('thinking');

      // Built before the optimistic append so it holds the turns the agent
      // should see - not the question it is about to be asked.
      const history = messages
        .filter((m) => !m.error)
        .slice(-HISTORY_TURNS)
        .map((m) => ({ role: m.role, content: m.content }));

      setMessages((prev) => [...prev, { role: 'user', content: message }]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const reply = await api.chat.ask(message, history, controller.signal);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: reply.answer,
            origin: reply.origin,
            suggestions: reply.suggestions,
          },
        ]);
        // Talk for roughly as long as the answer takes to read.
        setMood('speaking');
        clearTimeout(speakTimer.current);
        speakTimer.current = setTimeout(
          () => setMood('idle'),
          Math.min(1200 + reply.answer.length * 18, 5000)
        );
      } catch (error) {
        if (error.name === 'AbortError') return;
        setMood('idle');
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            error: true,
            content:
              error instanceof ApiError && error.status === 503
                ? 'I am not reachable at the moment. Please try again shortly, or call reception on +91 22 4567 8900.'
                : 'Something went wrong on my end. Please try that again.',
          },
        ]);
      } finally {
        setPending(false);
        abortRef.current = null;
      }
    },
    [messages, pending]
  );

  const lastMessage = messages[messages.length - 1];
  const suggestions =
    !pending && lastMessage?.role === 'assistant' ? (lastMessage.suggestions ?? []) : [];

  // After the hooks, never before - the rule is unconditional hook calls, and
  // the pathname changes as the guest navigates.
  if (HIDDEN_ON.some((route) => pathname?.startsWith(route))) return null;

  return (
    <>
      {/* ---- Launcher ---- */}
      <button
        ref={launcherRef}
        type="button"
        onClick={() => {
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={open ? 'Close the concierge' : 'Ask the concierge'}
        aria-controls={open ? 'hotel-concierge-panel' : undefined}
        className={'concierge-launcher fixed right-4 bottom-4 z-50 flex items-center gap-3 border border-cream-400 bg-cream-50 text-ink-900 sm:right-6 sm:bottom-6 ' + (open ? 'concierge-launcher--open' : '')}
      >
        {open ? <X className="size-5" aria-hidden /> : <>
          <span className="concierge-portrait" aria-hidden="true">
            <ConciergeCharacter state={pending ? 'thinking' : mood} frame="bust" className="h-full w-full" title="" />
          </span>
          <span className="hidden text-left sm:block">
            <span className="block font-serif text-lg font-semibold leading-tight">Ask Aarav</span>
            <span className="mt-1 block text-[11px] tracking-wide text-ink-500">Your hotel concierge</span>
          </span>
          <span className="hidden size-8 items-center justify-center rounded-full bg-cream-200 text-brass-800 sm:flex"><MessageCircle className="size-4" aria-hidden /></span>
        </>}
      </button>

      {/* ---- Panel ---- */}
      {open && (
        <div
          id="hotel-concierge-panel"
          role="dialog"
          aria-modal="false"
          aria-label="Concierge"
          data-lenis-prevent
          className="chat-panel fixed right-4 bottom-22 z-50 flex w-[min(23.5rem,calc(100vw-2rem))]
                     flex-col overflow-hidden rounded-2xl border border-cream-400 bg-cream-50
                     sm:right-6 sm:bottom-26"
          style={{ height: 'min(34rem, calc(100dvh - 8rem))' }}
        >
          {/* Header */}
          <header className="flex items-center gap-3 border-b border-cream-300 bg-cream-200 px-4 py-3">
            <span className="concierge-portrait concierge-portrait--header">
              <ConciergeCharacter
                state={pending ? 'thinking' : mood}
                frame="bust"
                className="h-full w-full"
                title=""
              />
            </span>
            <span className="min-w-0">
              <span className="block font-serif text-lg leading-tight font-semibold text-ink-900">
                Aarav
              </span>
              <span className="block truncate text-xs text-ink-500">
                {pending ? 'Looking that up…' : 'Concierge · The Meridian Grand'}
              </span>
            </span>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                launcherRef.current?.focus();
              }}
              aria-label="Close"
              className="ml-auto rounded-full p-1.5 text-ink-500 transition-colors hover:bg-cream-300 hover:text-ink-900"
            >
              <X className="size-4" aria-hidden />
            </button>
          </header>

          {/* Messages.
              overscroll-contain keeps a wheel that reaches the top or bottom of
              the conversation from chaining on to the page behind it. The
              panel's data-lenis-prevent is the other half: the landing page
              runs Lenis with smoothWheel, which takes the wheel event for the
              whole document, so without it scrolling the conversation scrolls
              the page instead. Both are needed - they fix different pages. */}
          <div
            ref={listRef}
            className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4"
            aria-live="polite"
            aria-atomic="false"
          >
            {/* Before the first question there is room to show him properly,
                uniform, bell and all - the detail the 44px crops cannot hold. */}
            {messages.length === 1 && (
              <ConciergeCharacter
                state={mood}
                className="mx-auto -mt-1 mb-1 h-28 w-24"
                title=""
              />
            )}

            {messages.map((message, i) =>
              message.role === 'user' ? (
                <p
                  key={i}
                  className="chat-bubble ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm
                             bg-ink-900 px-3.5 py-2 text-sm text-cream-100"
                >
                  {message.content}
                </p>
              ) : (
                <div
                  key={i}
                  className={`chat-bubble w-fit max-w-[92%] rounded-2xl rounded-bl-sm border px-3.5 py-2.5 text-sm
                              ${
                                message.error
                                  ? 'border-rose-200 bg-rose-50 text-rose-900'
                                  : 'border-cream-300 bg-white text-ink-800'
                              }`}
                >
                  {message.error && (
                    <MessageCircleOff className="mb-1 size-4 text-rose-500" aria-hidden />
                  )}
                  <AnswerBody text={message.content} />

                  {ORIGIN_LABEL[message.origin] && (
                    <span
                      className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-[0.65rem]
                                  font-medium ${ORIGIN_LABEL[message.origin].tone}`}
                    >
                      {ORIGIN_LABEL[message.origin].text}
                    </span>
                  )}
                </div>
              )
            )}

            {pending && (
              <div className="chat-bubble w-fit rounded-2xl rounded-bl-sm border border-cream-300 bg-white px-4 py-3">
                <span className="chat-typing flex gap-1" aria-label="Aarav is typing">
                  <span className="size-1.5 rounded-full bg-ink-300" />
                  <span className="size-1.5 rounded-full bg-ink-300" />
                  <span className="size-1.5 rounded-full bg-ink-300" />
                </span>
              </div>
            )}
          </div>

          {/* Suggested follow-ups */}
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-t border-cream-300 px-4 pt-3">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => send(suggestion)}
                  className="rounded-full border border-cream-400 bg-white px-2.5 py-1 text-xs
                             text-ink-600 transition-colors hover:border-sky-400 hover:bg-sky-100 hover:text-ink-900"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {/* Composer */}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 p-3"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about the hotel…"
              aria-label="Your question"
              maxLength={1000}
              className="min-w-0 flex-1 rounded-full border border-cream-400 bg-white px-4 py-2.5
                         text-sm text-ink-900 placeholder:text-ink-400 transition-colors focus:border-sky-400"
            />
            <button
              type="submit"
              disabled={!input.trim() || pending}
              aria-label="Send"
              className="grid size-10 shrink-0 place-items-center rounded-full bg-ink-900 text-cream-100
                         transition-colors hover:bg-ink-800 disabled:cursor-not-allowed disabled:bg-ink-200"
            >
              <ArrowUp className="size-4" aria-hidden />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

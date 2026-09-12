'use client';

import { ArrowUp, MessageCircleOff, Sparkles, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ConciergeCharacter } from '@/components/ConciergeCharacter';
import { api, ApiError } from '@/lib/api';

/**
 * The floating concierge, backed by the RAG agent in agent/.
 *
 * Two things here are deliberate rather than decorative:
 *
 *  - Every answer shows where it came from. The agent returns `origin` and
 *    `sources`, so a policy quoted from the hotel document is badged
 *    differently from live availability read out of the database, and the PDF
 *    section behind any claim is one tap away. The agent is built never to
 *    invent an answer; showing its working is what makes that legible.
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

/** Badge copy per `origin` value returned by the agent. */
const ORIGIN_LABEL = {
  live: { text: 'Live availability', tone: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  'live+document': {
    text: 'Live availability',
    tone: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  document: { text: 'From the hotel document', tone: 'bg-sky-100 text-ink-700 border-sky-200' },
};

/**
 * The agent writes plain text, using "- " for lists. Rendering those as a real
 * list keeps a four-clause cancellation policy readable.
 */
function AnswerBody({ text }) {
  const lines = text.split('\n').filter((line) => line.trim());
  const bullets = lines.filter((line) => line.trimStart().startsWith('- '));

  if (bullets.length < 2) {
    return <p className="whitespace-pre-line">{text}</p>;
  }

  const intro = lines.filter((line) => !line.trimStart().startsWith('- '));
  return (
    <>
      {intro.length > 0 && <p className="whitespace-pre-line">{intro.join('\n')}</p>}
      <ul className={intro.length > 0 ? 'mt-2 space-y-1.5' : 'space-y-1.5'}>
        {bullets.map((line, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden className="mt-[0.45rem] size-1 shrink-0 rounded-full bg-sky-500" />
            <span>{line.trimStart().slice(2)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function Sources({ sources }) {
  if (!sources?.length) return null;
  return (
    <details className="group mt-2.5">
      <summary
        className="inline-flex cursor-pointer list-none items-center gap-1 text-[0.7rem] font-medium
                   text-ink-400 transition-colors hover:text-ink-600"
      >
        <Sparkles className="size-3" aria-hidden />
        {sources.length === 1 ? '1 source' : `${sources.length} sources`}
      </summary>
      <ul className="mt-1.5 space-y-1.5 border-l-2 border-cream-300 pl-2.5">
        {sources.map((source, i) => (
          <li key={i} className="text-[0.7rem] leading-snug text-ink-400">
            <span className="font-medium text-ink-600">{source.citation}</span>
            {source.text && <span className="block italic">“{source.text}”</span>}
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Sign-in and registration are single-task screens; nothing floats over them. */
const HIDDEN_ON = ['/login', '/register'];

export function ChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
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
            sources: reply.sources,
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
          setEverOpened(true);
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={open ? 'Close the concierge' : 'Ask the concierge'}
        className="group fixed right-4 bottom-4 z-50 grid size-14 place-items-center rounded-full
                   border-2 border-ink-900 bg-sky-300 shadow-lg transition-transform
                   hover:scale-105 active:scale-95 sm:right-6 sm:bottom-6 sm:size-16"
      >
        {/* Draws the eye once, then never again. */}
        {!everOpened && (
          <span
            aria-hidden
            className="chat-launcher__ping absolute inset-0 rounded-full bg-sky-400"
          />
        )}
        {open ? (
          <X className="relative size-6 text-ink-900" aria-hidden />
        ) : (
          <ConciergeCharacter
            state={pending ? 'thinking' : mood}
            className="relative size-11 sm:size-12"
            title=""
          />
        )}
      </button>

      {/* ---- Panel ---- */}
      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Concierge"
          className="chat-panel fixed right-4 bottom-22 z-50 flex w-[min(23.5rem,calc(100vw-2rem))]
                     flex-col overflow-hidden rounded-2xl border border-cream-400 bg-cream-50
                     sm:right-6 sm:bottom-26"
          style={{ height: 'min(34rem, calc(100vh - 8rem))' }}
        >
          {/* Header */}
          <header className="flex items-center gap-3 border-b border-cream-300 bg-cream-200 px-4 py-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-ink-900 bg-sky-300">
              <ConciergeCharacter state={pending ? 'thinking' : mood} className="size-9" title="" />
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

          {/* Messages */}
          <div
            ref={listRef}
            className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
            aria-live="polite"
            aria-atomic="false"
          >
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
                  <Sources sources={message.sources} />
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

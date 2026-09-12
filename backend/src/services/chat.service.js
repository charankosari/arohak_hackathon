import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Client for the Python RAG agent (see agent/).
 *
 * The agent owns the knowledge base built from
 * AROHAK_Hotel_Information_For_RAG.pdf and answers guest questions from it. It
 * calls back into this API for live availability, so the two services form a
 * cycle - which is fine over HTTP, but means the timeout here must be
 * comfortably longer than the agent's own timeout onto us, or a slow
 * availability lookup would surface as a chat timeout instead.
 */

async function callAgent(path, body) {
  if (!env.agentUrl) {
    throw new ApiError(503, 'The hotel assistant is not configured on this server.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.agentTimeoutMs);

  let response;
  try {
    response = await fetch(`${env.agentUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    // Abort and connection refusal both land here. Neither is the caller's
    // fault, so report it as an upstream outage rather than a 500.
    const reason = error.name === 'AbortError' ? 'timed out' : 'is unavailable';
    console.error(`[chat] agent ${reason}: ${error.message}`);
    throw new ApiError(503, 'The hotel assistant is temporarily unavailable. Please try again.');
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error(`[chat] agent ${path} -> ${response.status}: ${detail.slice(0, 300)}`);
    // A 422 means our payload violated the agent's schema - our bug, not the
    // guest's, so it must not be reflected back as a 400.
    throw new ApiError(502, 'The hotel assistant returned an unexpected response.');
  }

  return response.json();
}

/**
 * Answer a guest question from the hotel document plus live availability.
 *
 * `history` lets the agent resolve a terse follow-up ("and the pool?") against
 * the previous turn.
 */
export async function ask({ message, history = [] }) {
  const result = await callAgent('/chat', { message, history });
  return {
    question: result.question,
    answer: result.answer,
    // "document" | "live" | "live+document" | "none" - the UI can badge a live
    // answer differently from a policy quoted out of the PDF.
    origin: result.origin,
    confidence: result.confidence,
    // Citations back into the PDF, so an answer is traceable (PDF section 12).
    sources: result.sources ?? [],
    suggestions: result.suggestions ?? [],
  };
}

/** Raw retrieval hits - useful for debugging what the bot actually saw. */
export async function search({ query, k = 5 }) {
  return callAgent('/search', { query, k });
}

/** Agent liveness, folded into this API's own health report. */
export async function health() {
  if (!env.agentUrl) return { configured: false, status: 'disabled' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    const response = await fetch(`${env.agentUrl}/health`, { signal: controller.signal });
    if (!response.ok) return { configured: true, status: 'down' };
    const body = await response.json();
    return { configured: true, status: 'up', knowledgeBase: body.knowledgeBase };
  } catch {
    return { configured: true, status: 'down' };
  } finally {
    clearTimeout(timer);
  }
}

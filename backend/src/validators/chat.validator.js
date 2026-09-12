import { z } from 'zod';

/** One prior turn, so the agent can resolve a terse follow-up. */
const turn = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(2000),
});

export const askSchema = z.object({
  message: z.string().trim().min(1, 'Ask a question').max(1000),
  // Capped: the agent only looks at the most recent user turn, and an
  // unbounded history would be a cheap way to inflate every request.
  history: z.array(turn).max(20).default([]),
});

export const searchSchema = z.object({
  query: z.string().trim().min(1).max(1000),
  k: z.coerce.number().int().min(1).max(20).default(5),
});

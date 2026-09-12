import { Router } from 'express';
import * as controller from '../controllers/chat.controller.js';
import { optionalAuthenticate, authenticate, requireStaff } from '../middlewares/auth.middleware.js';
import { chatLimiter } from '../middlewares/rateLimit.middleware.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import { askSchema, searchSchema } from '../validators/chat.validator.js';

const router = Router();

// Guests ask questions before they have an account, so this is public.
// optionalAuthenticate still attaches req.user when a token is present, which
// is what the rate limiter keys on.
router.post(
  '/',
  chatLimiter,
  optionalAuthenticate,
  validateBody(askSchema),
  controller.ask
);

// Whether the assistant is reachable, for status pages and the smoke test.
router.get('/health', controller.health);

// Raw retrieval output. Staff only: it exposes the whole knowledge base a
// chunk at a time, which is a debugging tool rather than a guest feature.
router.post(
  '/search',
  authenticate,
  requireStaff,
  validateBody(searchSchema),
  controller.search
);

export default router;

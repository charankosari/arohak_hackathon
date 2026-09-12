import { Router } from 'express';
import * as controller from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authLimiter } from '../middlewares/rateLimit.middleware.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from '../validators/auth.validator.js';

const router = Router();

// Public. Rate limited per IP + email against credential stuffing.
router.post('/register', authLimiter, validateBody(registerSchema), controller.register);
router.post('/login', authLimiter, validateBody(loginSchema), controller.login);

// Authenticated self-service.
router.get('/me', authenticate, controller.me);
router.patch('/me', authenticate, validateBody(updateProfileSchema), controller.updateProfile);
router.post(
  '/change-password',
  authenticate,
  authLimiter,
  validateBody(changePasswordSchema),
  controller.changePassword
);

export default router;

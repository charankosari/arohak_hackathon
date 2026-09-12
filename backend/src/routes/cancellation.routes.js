import { Router } from 'express';
import * as controller from '../controllers/cancellation.controller.js';
import { authenticate, requireStaff } from '../middlewares/auth.middleware.js';
import { validateBody, validateParams, validateQuery } from '../middlewares/validate.middleware.js';
import { idParam } from '../validators/common.validator.js';
import {
  listCancellationsSchema,
  reviewCancellationSchema,
} from '../validators/cancellation.validator.js';

const router = Router();

router.use(authenticate);

// Customers see their own requests; staff see the whole review queue.
router.get('/', validateQuery(listCancellationsSchema), controller.listRequests);
router.get('/:id', validateParams(idParam), controller.getRequest);

// Approving or rejecting is a staff decision - both ADMIN and RECEPTIONIST,
// since handling cancellations is core front-desk work.
router.post(
  '/:id/review',
  requireStaff,
  validateParams(idParam),
  validateBody(reviewCancellationSchema),
  controller.reviewRequest
);

export default router;

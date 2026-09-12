import { Router } from 'express';
import * as controller from '../controllers/booking.controller.js';
import { authenticate, requireStaff } from '../middlewares/auth.middleware.js';
import { bookingWriteLimiter } from '../middlewares/rateLimit.middleware.js';
import { validateBody, validateParams, validateQuery } from '../middlewares/validate.middleware.js';
import { idParam } from '../validators/common.validator.js';
import {
  cancelBookingSchema,
  createBookingSchema,
  listBookingsSchema,
  modifyBookingSchema,
  updateBookingStatusSchema,
} from '../validators/booking.validator.js';

const router = Router();

// Every booking route requires a signed-in account.
router.use(authenticate);

// Front-desk day view: today's arrivals and departures. Staff only.
router.get('/front-desk', requireStaff, controller.frontDesk);

// Customers get their own bookings here; staff get everything. The service
// pins the filter to the caller, so a customer cannot read another guest's list.
router.get('/', validateQuery(listBookingsSchema), controller.listBookings);

router.post(
  '/',
  bookingWriteLimiter,
  validateBody(createBookingSchema),
  controller.createBooking
);

router.get('/:id', validateParams(idParam), controller.getBooking);

// What would happen if I cancelled right now? Drives the UI warning.
router.get('/:id/cancellation-policy', validateParams(idParam), controller.cancellationPolicy);

// Cancel, or raise a review request when outside the 24-hour window.
router.post(
  '/:id/cancel',
  bookingWriteLimiter,
  validateParams(idParam),
  validateBody(cancelBookingSchema),
  controller.cancelBooking
);

// Date changes are subject to availability (PDF section 3).
router.patch(
  '/:id',
  bookingWriteLimiter,
  validateParams(idParam),
  validateBody(modifyBookingSchema),
  controller.modifyBooking
);

// Check-in / check-out / no-show are front-desk actions.
router.patch(
  '/:id/status',
  requireStaff,
  validateParams(idParam),
  validateBody(updateBookingStatusSchema),
  controller.updateStatus
);

export default router;

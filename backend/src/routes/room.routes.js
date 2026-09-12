import { Router } from 'express';
import * as controller from '../controllers/room.controller.js';
import {
  authenticate,
  optionalAuthenticate,
  requireAdmin,
  requireStaff,
} from '../middlewares/auth.middleware.js';
import { searchLimiter } from '../middlewares/rateLimit.middleware.js';
import imageRoutes from './image.routes.js';
import { validateBody, validateParams, validateQuery } from '../middlewares/validate.middleware.js';
import { idParam } from '../validators/common.validator.js';
import {
  createRoomSchema,
  listRoomsSchema,
  roomAvailabilitySchema,
  roomCalendarSchema,
  roomTypesSchema,
  searchAvailabilitySchema,
  updateRoomSchema,
} from '../validators/room.validator.js';

const router = Router();

// Photo gallery for a room.
router.use('/:id/images', imageRoutes);

// --- Public browsing -------------------------------------------------------
router.get(
  '/availability',
  searchLimiter,
  optionalAuthenticate,
  validateQuery(searchAvailabilitySchema),
  controller.searchAvailability
);
router.get('/types', validateQuery(roomTypesSchema), controller.getRoomTypes);
router.get('/', optionalAuthenticate, validateQuery(listRoomsSchema), controller.listRooms);

// Whether one specific room is free for a stay. Public: a guest needs this
// before signing in.
router.get(
  '/:id/availability',
  searchLimiter,
  validateParams(idParam),
  validateQuery(roomAvailabilitySchema),
  controller.roomAvailability
);

// --- Staff ----------------------------------------------------------------
// Occupancy calendar: operational detail, so staff only.
router.get(
  '/:id/calendar',
  authenticate,
  requireStaff,
  validateParams(idParam),
  validateQuery(roomCalendarSchema),
  controller.roomCalendar
);

router.get('/:id', validateParams(idParam), controller.getRoom);

// Creating and deleting inventory is an admin act.
router.post('/', authenticate, requireAdmin, validateBody(createRoomSchema), controller.createRoom);
router.delete('/:id', authenticate, requireAdmin, validateParams(idParam), controller.deleteRoom);

// Both staff roles can edit a room, but the controller narrows a receptionist
// to operational fields (status, description) only.
router.patch(
  '/:id',
  authenticate,
  requireStaff,
  validateParams(idParam),
  validateBody(updateRoomSchema),
  controller.updateRoom
);

export default router;

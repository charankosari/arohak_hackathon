import { Router } from 'express';
import * as controller from '../controllers/hotel.controller.js';
import {
  authenticate,
  optionalAuthenticate,
  requireAdmin,
} from '../middlewares/auth.middleware.js';
import { validateBody, validateParams, validateQuery } from '../middlewares/validate.middleware.js';
import { idParam } from '../validators/common.validator.js';
import { createHotelSchema, listHotelsSchema, updateHotelSchema } from '../validators/hotel.validator.js';
import imageRoutes from './image.routes.js';

const router = Router();

// Photo gallery for a property.
router.use('/:id/images', imageRoutes);

// Browsing is open to guests (signed in or not); optionalAuthenticate lets the
// service widen results to INACTIVE hotels when a staff member is looking.
router.get('/', optionalAuthenticate, validateQuery(listHotelsSchema), controller.listHotels);
router.get('/:id', optionalAuthenticate, validateParams(idParam), controller.getHotel);

// Property management is admin-only. Receptionists explicitly cannot create,
// edit or remove hotels.
router.post('/', authenticate, requireAdmin, validateBody(createHotelSchema), controller.createHotel);
router.patch(
  '/:id',
  authenticate,
  requireAdmin,
  validateParams(idParam),
  validateBody(updateHotelSchema),
  controller.updateHotel
);
router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  validateParams(idParam),
  controller.deleteHotel
);

export default router;

import { Router } from 'express';
import * as controller from '../controllers/image.controller.js';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware.js';
import { uploadImages } from '../middlewares/upload.middleware.js';
import { validateBody, validateParams } from '../middlewares/validate.middleware.js';
import {
  imageParams,
  reorderImagesSchema,
  updateImageSchema,
} from '../validators/image.validator.js';

/**
 * Mounted twice - under /hotels/:id/images and /rooms/:id/images - so
 * `mergeParams` is needed to see the parent :id.
 */
const router = Router({ mergeParams: true });

// Galleries are public: guests need to see the photos.
router.get('/', controller.list);

// Managing photography is a property-management task, so admin only.
router.post('/', authenticate, requireAdmin, uploadImages('images', 8), controller.upload);

router.patch(
  '/order',
  authenticate,
  requireAdmin,
  validateBody(reorderImagesSchema),
  controller.reorder
);

router.patch(
  '/:imageId',
  authenticate,
  requireAdmin,
  validateParams(imageParams),
  validateBody(updateImageSchema),
  controller.update
);

router.delete(
  '/:imageId',
  authenticate,
  requireAdmin,
  validateParams(imageParams),
  controller.remove
);

export default router;

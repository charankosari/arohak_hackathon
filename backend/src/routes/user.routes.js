import { Router } from 'express';
import * as controller from '../controllers/user.controller.js';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware.js';
import { validateBody, validateParams, validateQuery } from '../middlewares/validate.middleware.js';
import { idParam } from '../validators/common.validator.js';
import {
  createUserSchema,
  listUsersSchema,
  updateUserSchema,
} from '../validators/user.validator.js';

const router = Router();

// User administration is admin-only in its entirety - a receptionist has no
// access to any route in this file.
router.use(authenticate, requireAdmin);

router.get('/dashboard', controller.dashboard);
router.get('/', validateQuery(listUsersSchema), controller.listUsers);
router.post('/', validateBody(createUserSchema), controller.createUser);
router.get('/:id', validateParams(idParam), controller.getUser);
router.patch(
  '/:id',
  validateParams(idParam),
  validateBody(updateUserSchema),
  controller.updateUser
);
router.delete('/:id', validateParams(idParam), controller.deactivateUser);

export default router;

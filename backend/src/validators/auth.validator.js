import { z } from 'zod';
import { email, name, password, phone } from './common.validator.js';

/**
 * Public signup deliberately has no `role` field - self-service accounts are
 * always CUSTOMER. Staff accounts are created by an admin via /api/users.
 */
export const registerSchema = z.object({
  name,
  email,
  password,
  phone,
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'password is required'),
});

export const updateProfileSchema = z
  .object({
    name: name.optional(),
    phone: phone.or(z.literal('')),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'Provide at least one field to update');

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'current password is required'),
  newPassword: password,
});

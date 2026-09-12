import { z } from 'zod';
import { email, name, pagination, password, phone, roleEnum } from './common.validator.js';

export const listUsersSchema = pagination.extend({
  role: roleEnum.optional(),
  search: z.string().trim().min(1).max(120).optional(),
});

export const createUserSchema = z.object({
  name,
  email,
  password,
  role: roleEnum,
  phone,
});

export const updateUserSchema = z
  .object({
    name: name.optional(),
    email: email.optional(),
    password: password.optional(),
    role: roleEnum.optional(),
    phone: phone.or(z.literal('')).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, 'Provide at least one field to update');

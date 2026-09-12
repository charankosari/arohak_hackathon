import { z } from 'zod';
import { cancellationStatusEnum, pagination, uuid } from './common.validator.js';

export const listCancellationsSchema = pagination.extend({
  status: cancellationStatusEnum.optional(),
  bookingId: uuid.optional(),
  requestedById: uuid.optional(),
});

export const reviewCancellationSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  reviewNote: z.string().trim().max(500).optional(),
});

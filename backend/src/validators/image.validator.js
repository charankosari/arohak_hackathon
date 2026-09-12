import { z } from 'zod';
import { uuid } from './common.validator.js';

export const imageParams = z.object({ id: uuid, imageId: uuid });

export const updateImageSchema = z
  .object({
    alt: z.string().trim().max(200).or(z.literal('')),
    position: z.coerce.number().int().min(0).max(50),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, 'Provide alt or position');

export const reorderImagesSchema = z.object({
  /** Every image id for this hotel/room, in the order they should display. */
  orderedIds: z.array(uuid).min(1).max(50),
});

import * as imageService from '../services/image.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/** Owner comes from the mounting route: /hotels/:id/images or /rooms/:id/images. */
const ownerFrom = (req) =>
  req.baseUrl.includes('/hotels') ? { hotelId: req.params.id } : { roomId: req.params.id };

export const list = asyncHandler(async (req, res) => {
  res.json(await imageService.listImages(ownerFrom(req)));
});

export const upload = asyncHandler(async (req, res) => {
  const result = await imageService.uploadImages({
    ...ownerFrom(req),
    files: req.files,
    actorId: req.user.id,
    alt: req.body?.alt,
  });
  res.status(201).json(result);
});

export const reorder = asyncHandler(async (req, res) => {
  res.json(
    await imageService.reorderImages({ ...ownerFrom(req), orderedIds: req.body.orderedIds })
  );
});

export const update = asyncHandler(async (req, res) => {
  res.json({ image: await imageService.updateImage(req.params.imageId, req.body) });
});

export const remove = asyncHandler(async (req, res) => {
  res.json(await imageService.deleteImage(req.params.imageId));
});

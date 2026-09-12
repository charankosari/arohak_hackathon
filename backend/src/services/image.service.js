import { cache } from '../lib/cache.js';
import {
  destroyAsset,
  folderFor,
  isCloudinaryConfigured,
  uploadBuffer,
} from '../lib/cloudinary.js';
import { prisma } from '../lib/prisma.js';
import { hotelModel } from '../models/hotel.model.js';
import { imageModel } from '../models/image.model.js';
import { roomModel } from '../models/room.model.js';
import { ApiError } from '../utils/ApiError.js';
import { serializeImage } from '../utils/serialize.js';

/** Resolve and validate the owner of the images being managed. */
async function resolveOwner({ hotelId, roomId }) {
  if (hotelId) {
    const hotel = await hotelModel.findById(hotelId);
    if (!hotel) throw ApiError.notFound('Hotel not found');
    return { kind: 'hotels', where: { hotelId }, label: hotel.name };
  }
  const room = await roomModel.findByIdWithHotel(roomId);
  if (!room) throw ApiError.notFound('Room not found');
  return { kind: 'rooms', where: { roomId }, label: `Room ${room.roomNumber}` };
}

const MAX_IMAGES = 12;

export async function listImages({ hotelId, roomId }) {
  const owner = await resolveOwner({ hotelId, roomId });
  const images = await imageModel.listFor(owner.where);
  return { total: images.length, images: images.map(serializeImage) };
}

/**
 * Upload one or more files and attach them to a hotel or room.
 * New images go to the end of the existing order.
 */
export async function uploadImages({ hotelId, roomId, files, actorId, alt }) {
  if (!isCloudinaryConfigured()) {
    throw new ApiError(
      503,
      'Image hosting is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY ' +
        'and CLOUDINARY_API_SECRET in backend/.env and restart the API.'
    );
  }
  if (!files?.length) throw ApiError.badRequest('No image files were uploaded');

  const owner = await resolveOwner({ hotelId, roomId });
  const existing = await imageModel.countFor(owner.where);

  if (existing + files.length > MAX_IMAGES) {
    throw ApiError.conflict(
      `${owner.label} can hold at most ${MAX_IMAGES} images (currently ${existing})`
    );
  }

  const startPosition = await imageModel.nextPosition(owner.where);
  const created = [];

  for (const [index, file] of files.entries()) {
    let uploaded;
    try {
      uploaded = await uploadBuffer(file.buffer, {
        folder: folderFor(owner.kind),
        tags: [owner.kind],
      });
    } catch (error) {
      // Surface Cloudinary's own message; it is usually actionable
      // (bad credentials, quota, unsupported file).
      throw new ApiError(502, `Image upload failed: ${error.message ?? 'unknown error'}`);
    }

    created.push(
      await imageModel.create({
        publicId: uploaded.public_id,
        url: uploaded.secure_url,
        width: uploaded.width,
        height: uploaded.height,
        format: uploaded.format,
        bytes: uploaded.bytes,
        alt: alt?.trim() || null,
        position: startPosition + index,
        uploadedById: actorId,
        ...owner.where,
      })
    );
  }

  await invalidate(owner.kind);
  return { uploaded: created.length, images: created.map(serializeImage) };
}

export async function updateImage(id, { alt, position }) {
  const image = await imageModel.findById(id);
  if (!image) throw ApiError.notFound('Image not found');

  const updated = await imageModel.update(id, {
    ...(alt !== undefined ? { alt: alt?.trim() || null } : {}),
    ...(position !== undefined ? { position } : {}),
  });

  await invalidate(image.roomId ? 'rooms' : 'hotels');
  return serializeImage(updated);
}

/** Reorder in one transaction so the gallery never renders half-sorted. */
export async function reorderImages({ hotelId, roomId, orderedIds }) {
  const owner = await resolveOwner({ hotelId, roomId });
  const images = await imageModel.listFor(owner.where);

  const known = new Set(images.map((i) => i.id));
  if (orderedIds.length !== images.length || orderedIds.some((id) => !known.has(id))) {
    throw ApiError.badRequest(
      'orderedIds must list every image belonging to this item, exactly once'
    );
  }

  await prisma.$transaction(
    orderedIds.map((id, position) => imageModel.update(id, { position }))
  );

  await invalidate(owner.kind);
  return listImages({ hotelId, roomId });
}

/** Remove from Cloudinary and from the database. */
export async function deleteImage(id) {
  const image = await imageModel.findById(id);
  if (!image) throw ApiError.notFound('Image not found');

  if (isCloudinaryConfigured()) {
    try {
      await destroyAsset(image.publicId);
    } catch (error) {
      // A missing remote asset should not block cleaning up our own row;
      // anything else is worth surfacing.
      if (!/not found/i.test(error.message ?? '')) {
        throw new ApiError(502, `Could not delete the image from Cloudinary: ${error.message}`);
      }
    }
  }

  await imageModel.delete(id);
  await invalidate(image.roomId ? 'rooms' : 'hotels');
  return { message: 'Image deleted' };
}

function invalidate(kind) {
  return kind === 'rooms' ? cache.invalidateRooms() : cache.invalidateHotels();
}

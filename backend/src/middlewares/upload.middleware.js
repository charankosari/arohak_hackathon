import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB per image
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

/**
 * Files are held in memory and streamed straight to Cloudinary, so nothing is
 * ever written to the API's disk.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 8 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      return cb(ApiError.badRequest(`Unsupported image type "${file.mimetype}". Use JPEG, PNG, WebP or AVIF.`));
    }
    cb(null, true);
  },
});

/** Wraps multer so its own errors become our JSON error shape. */
export const uploadImages = (field = 'images', maxCount = 8) => (req, res, next) => {
  upload.array(field, maxCount)(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError) {
      const messages = {
        LIMIT_FILE_SIZE: `Each image must be ${MAX_BYTES / 1024 / 1024} MB or smaller`,
        LIMIT_FILE_COUNT: `At most ${maxCount} images per upload`,
        LIMIT_UNEXPECTED_FILE: `Unexpected field - send files as "${field}"`,
      };
      return next(ApiError.badRequest(messages[error.code] ?? error.message));
    }
    next(error);
  });
};

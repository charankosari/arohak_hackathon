import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';

/**
 * Cloudinary is optional in the same way Redis is: without credentials the app
 * runs fine, image upload simply reports that it is not configured, and the UI
 * falls back to its designed placeholders.
 */

const configured = Boolean(
  env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret
);

if (configured) {
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
    secure: true,
  });
  console.log(`[cloudinary] configured for cloud "${env.cloudinaryCloudName}"`);
} else {
  console.log('[cloudinary] not configured - image upload disabled');
}

export const isCloudinaryConfigured = () => configured;

/** Everything lives under one folder so the account stays tidy. */
const FOLDER = 'meridian';

export const folderFor = (kind) => `${FOLDER}/${kind}`;

/**
 * Upload a buffer. Cloudinary's Node SDK exposes a stream API rather than a
 * promise for buffers, so it is wrapped here.
 */
export function uploadBuffer(buffer, { folder, publicId, tags = [] }) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        tags: [FOLDER, ...tags],
        resource_type: 'image',
        overwrite: true,
        // Strip metadata, auto-pick the best format and a sane quality, and
        // cap the stored dimensions - hotel photos do not need to be 6000px.
        transformation: [{ width: 2000, height: 2000, crop: 'limit' }],
        format: undefined,
        quality: 'auto',
        fetch_format: 'auto',
      },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    stream.end(buffer);
  });
}

/** Upload straight from a URL - used by the starter-image seeding script. */
export function uploadFromUrl(url, { folder, publicId, tags = [] }) {
  return cloudinary.uploader.upload(url, {
    folder,
    public_id: publicId,
    tags: [FOLDER, ...tags],
    resource_type: 'image',
    overwrite: true,
    transformation: [{ width: 2000, height: 2000, crop: 'limit' }],
    quality: 'auto',
    fetch_format: 'auto',
  });
}

export function destroyAsset(publicId) {
  return cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
}

export { cloudinary };

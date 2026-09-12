/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Admin-uploaded hotel and room photography.
      { protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/**' },
    ],
    // Cloudinary already serves AVIF/WebP; these are the widths the layout uses.
    deviceSizes: [400, 640, 828, 1080, 1200, 1600, 1920],
    imageSizes: [96, 160, 256, 384],
  },
};

export default nextConfig;

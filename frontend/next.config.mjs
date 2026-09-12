/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emits .next/standalone with a self-contained server.js and only the
  // node_modules actually reached at runtime - the Docker image is a fraction
  // of the size of copying the whole dependency tree.
  output: 'standalone',

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

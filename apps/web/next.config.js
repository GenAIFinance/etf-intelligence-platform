/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Disable static page generation to prevent build-time API calls
  staticPageGenerationTimeout: 1000,
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
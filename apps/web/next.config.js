/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
   images: {
    unoptimized: true,
  },
  transpilePackages: ['@etf-intelligence/shared'],
  
};

module.exports = nextConfig;

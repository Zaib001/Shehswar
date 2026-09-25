/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@shehswar/types', '@shehswar/shared'],
  poweredByHeader: false,
};

module.exports = nextConfig;

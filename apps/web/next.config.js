/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@shehswar/types', '@shehswar/shared'],
  poweredByHeader: false,
  output: process.env.NEXT_OUTPUT_STANDALONE === 'true' ? 'standalone' : undefined,
  async rewrites() {
    const rawTarget =
      process.env.BACKEND_API_URL ||
      process.env.INTERNAL_API_URL ||
      process.env.API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:4000';
    const destinationTarget = rawTarget.replace(/\/$/, '');

    return [
      {
        source: '/api/v1/:path*',
        destination: `${destinationTarget}/api/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;

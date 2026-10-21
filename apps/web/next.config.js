/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@shehswar/types', '@shehswar/shared'],
  poweredByHeader: false,
  output: process.env.NEXT_OUTPUT_STANDALONE === 'true' ? 'standalone' : undefined,
  async rewrites() {
    let rawTarget =
      process.env.BACKEND_API_URL ||
      process.env.INTERNAL_API_URL ||
      process.env.API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      (process.env.NODE_ENV === 'production'
        ? 'https://shehswar-api.onrender.com'
        : 'http://localhost:4000');

    // Handle Render internal hostport (e.g. shehswar-api:10000 or shehswar-api) which is unreachable on free tier
    if (rawTarget.includes('shehswar-api') && !rawTarget.includes('.')) {
      rawTarget = 'https://shehswar-api.onrender.com';
    }

    if (!rawTarget.startsWith('http://') && !rawTarget.startsWith('https://')) {
      rawTarget = `https://${rawTarget}`;
    }
    const destinationTarget = rawTarget.replace(/\/$/, '');

    return [
      {
        source: '/api/v1/:path*',
        destination: `${destinationTarget}/api/v1/:path*`,
      },
    ];
  },
  experimental: {
    cpus: 1,
    workerThreads: false,
  },
};

module.exports = nextConfig;

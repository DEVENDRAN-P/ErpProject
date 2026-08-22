/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL ? process.env.BACKEND_URL.replace(/\/$/, '') : '';
    // Only rewrite to backendUrl if BACKEND_URL is explicitly set and not pointing to localhost/127.0.0.1
    if (!backendUrl || backendUrl.includes('localhost') || backendUrl.includes('127.0.0.1')) {
      return [];
    }
    return [{ source: '/api/:path*', destination: `${backendUrl}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

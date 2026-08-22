/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Improve compilation speed by reducing output file tracing
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  async rewrites() {
    const backendUrl = (process.env.BACKEND_URL || 'http://localhost:8000').replace(/\/$/, '');
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

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Improve compilation speed by reducing output file tracing
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  async rewrites() {
    return [{ source: '/api/:path*', destination: 'http://localhost:8000/api/:path*' }];
  }
};

module.exports = nextConfig;

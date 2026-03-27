/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // Enable standalone output for Docker
  // pdf-parse / pdfjs-dist pull in worker assets; keep them external for server bundles
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist', 'mammoth'],

  // Security headers (HSTS only in production — sending HSTS over http://localhost breaks client
  // navigation in dev: browsers upgrade to HTTPS and RSC fetches fail with "Failed to fetch".)
  async headers() {
    const base = [
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-XSS-Protection', value: '1; mode=block' },
      { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=()',
      },
    ]
    if (process.env.NODE_ENV === 'production') {
      base.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      })
    }
    return [{ source: '/:path*', headers: base }]
  },
}

module.exports = nextConfig


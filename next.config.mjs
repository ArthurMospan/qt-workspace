/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next externalizes firebase-admin by default. With Firebase Admin 14's
  // required subpath exports (`firebase-admin/app`, `/auth`, `/firestore`), the
  // Vercel function trace can omit those runtime modules even though `next
  // build` succeeds. Bundle the package into every server function that uses
  // it so deployed APIs cannot fail during module evaluation.
  transpilePackages: ['firebase-admin'],
  async headers() {
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), geolocation=(), browsing-topics=()',
      },
    ];

    if (process.env.NODE_ENV === 'production') {
      securityHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000',
      });
    }

    return [{ source: '/:path*', headers: securityHeaders }];
  },
  async redirects() {
    return [
      {
        source: '/workspace/:path*',
        destination: '/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

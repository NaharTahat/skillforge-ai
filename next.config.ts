import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
// HSTS and upgrade-insecure-requests only make sense when the app is served over https.
const isHttps = (process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith(
  "https://",
);

/**
 * Content-Security-Policy. Next.js App Router streams inline scripts, so
 * script-src needs 'unsafe-inline' without nonces (a nonce-based policy would
 * force every page to render dynamically; see SECURITY.md). Everything else is
 * locked down: no plugins, no framing, no foreign scripts, styles or fonts,
 * form posts and fetches to this origin only. Images allow https so user
 * avatars (OAuth or an https URL) keep working.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  // React's development build needs eval; production doesn't.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // Hot reload uses a websocket in development.
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  ...(isHttps ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Origin-Agent-Cluster", value: "?1" },
  // Two years; add "preload" only after submitting the domain to the preload list.
  ...(isHttps
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // API responses carry per-user data: never cache them in shared caches.
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
    ];
  },
  async redirects() {
    // The Phase 1 placeholder route; Job Match lives at /dashboard/job-match.
    return [{ source: "/dashboard/jobs", destination: "/dashboard/job-match", permanent: true }];
  },
};

export default nextConfig;

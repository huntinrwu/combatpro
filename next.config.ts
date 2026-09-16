import type { NextConfig } from "next";

const securityHeaders = [
  // Deny framing so the app can't be embedded and clickjacked. frame-ancestors
  // in a full CSP would supersede this, but we don't ship a locked-down CSP
  // yet (Next inlines runtime scripts that would need a nonce).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // PDF ruleset uploads run through server actions; bump the default 1MB cap.
      bodySizeLimit: "15mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/api/chat": [
      "./data/catalog.json",
      "./vendor/scientific-agent-skills/skills/*/SKILL.md",
      "./public/library/skills/*/SKILL.md",
    ],
  },
  async headers() {
    const isDevelopment = process.env.NODE_ENV === "development";
    // React's development stack reconstruction requires eval. Production
    // deliberately excludes it; only local HMR needs the WebSocket origins.
    const scriptSources = ["'self'", "'unsafe-inline'", ...(isDevelopment ? ["'unsafe-eval'"] : [])];
    const connectSources = ["'self'", ...(isDevelopment ? ["ws://localhost:*", "ws://127.0.0.1:*"] : [])];
    const contentSecurityPolicy = [
      "default-src 'self'",
      `script-src ${scriptSources.join(" ")}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      `connect-src ${connectSources.join(" ")}`,
      "font-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; ");
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy,
          },
        ],
      },
    ];
  },
};
export default config;

import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["exceljs", "puppeteer-core", "@sparticuz/chromium"],
  experimental: {
    serverActions: {
      // Attachments are uploaded through a Server Action and may be up to 10 MB.
      bodySizeLimit: "11mb",
    },
  },
  outputFileTracingIncludes: {
    "/reports/export": ["./src/lib/reports/fonts/*.ttf"],
    "/api/documents/pdf": [
      "./public/documents/fonts/*.ttf",
      "./public/documents/setc.css",
      "./public/brand/letterhead-300dpi.png",
      "./node_modules/@sparticuz/chromium/bin/**",
    ],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
      {
        source: "/offline.html",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

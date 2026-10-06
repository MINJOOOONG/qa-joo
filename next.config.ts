import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright is only used by the optional browser analyzer and must never be bundled.
  serverExternalPackages: ["playwright", "playwright-core"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;

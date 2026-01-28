import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@repo/ui", "@repo/common"],
  allowedDevOrigins: ["http://finance.tagaroa.local"],
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "9000",
        pathname: "/storage/**",
      },
    ],
  },
};

export default nextConfig;

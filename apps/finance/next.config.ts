import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

const nextConfig: NextConfig = {
  output: "standalone",
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

export default () => {
  if (process.env.ANALYZE === "true") {
    return withBundleAnalyzer({
      enabled: true,
    })(nextConfig);
  }
  return nextConfig;
};

import withBundleAnalyzer from "@next/bundle-analyzer";
import type { NextConfig } from "next";

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

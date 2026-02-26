import withBundleAnalyzer from "@next/bundle-analyzer";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@repo/ui", "@repo/common", "@repo/auth"],
};

export default () => {
  if (process.env.ANALYZE === "true") {
    return withBundleAnalyzer({
      enabled: true,
    })(nextConfig);
  }
  return nextConfig;
};

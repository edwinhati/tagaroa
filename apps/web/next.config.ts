import withBundleAnalyzer from "@next/bundle-analyzer";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@repo/ui", "@repo/common"],
};

export default () => {
  if (process.env.ANALYZE === "true") {
    return withBundleAnalyzer({
      enabled: true,
    })(nextConfig);
  }
  return nextConfig;
};

import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default () => {
  if (process.env.ANALYZE === "true") {
    return withBundleAnalyzer({
      enabled: true,
    })(nextConfig);
  }
  return nextConfig;
};

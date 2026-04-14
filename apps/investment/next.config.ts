import withBundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@repo/ui", "@repo/common"],
};

export default withSentryConfig(
  process.env.ANALYZE === "true"
    ? withBundleAnalyzer({ enabled: true })(nextConfig)
    : nextConfig,
  {
    silent: true,
    sourcemaps: {
      disable: true,
    },
    tunnelRoute: process.env.NODE_ENV === "production" ? "/api/e" : undefined,
  },
);

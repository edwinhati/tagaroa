import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: false,
  transpilePackages: ["@repo/ui", "@repo/common"],
};

export default nextConfig;

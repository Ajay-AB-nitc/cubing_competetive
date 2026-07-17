import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['three'],
  distDir: process.env.BUILD_DIR || ".next",
};

export default nextConfig;

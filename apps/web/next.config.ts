import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@nexus/env"],
  experimental: {
    // Enable modern caching behaviors
  },
};

export default nextConfig;

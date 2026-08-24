import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["turkey-location-data"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;

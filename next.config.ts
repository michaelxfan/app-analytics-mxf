import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Serve the root page for /work-now so hard reloads work
      { source: "/work-now", destination: "/" },
      { source: "/workflow", destination: "/" },
    ];
  },
};

export default nextConfig;

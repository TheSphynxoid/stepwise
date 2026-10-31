import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@sphynxoid/stepwise"],
  async redirects() {
    // /eviction was the player demo's historical (portfolio-era) path.
    return [{ source: "/eviction", destination: "/player", permanent: true }];
  },
};

export default nextConfig;

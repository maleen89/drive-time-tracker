import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      { source: "/pairs", destination: "/setup", permanent: true },
      { source: "/schedule", destination: "/setup", permanent: true },
    ];
  },
};

export default nextConfig;

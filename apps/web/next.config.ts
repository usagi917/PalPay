import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    // Avoid dev-only segment explorer issues in React Client Manifest.
    devtoolSegmentExplorer: false,
  },
  images: {
    // Allow cache-busted local API images with query strings.
    localPatterns: [{ pathname: "/api/nft/**" }],
  },
};

export default nextConfig;

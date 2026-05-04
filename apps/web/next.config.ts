import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    // Avoid dev-only segment explorer issues in React Client Manifest.
    devtoolSegmentExplorer: false,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          "**/.next/**",
          "**/node_modules/**",
          "../../lib/**",
        ],
      };
    }

    return config;
  },
  images: {
    // Allow cache-busted local API images with query strings.
    localPatterns: [{ pathname: "/api/nft/**" }],
  },
};

export default nextConfig;

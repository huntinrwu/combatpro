import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // PDF ruleset uploads run through server actions; bump the default 1MB cap.
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;

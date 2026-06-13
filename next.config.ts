import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/**/*": ["./node_modules/youtube-dl-exec/bin/**/*"],
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Move the Next.js dev indicator away from bottom-left to avoid overlapping the sidebar.
  devIndicators: { position: "bottom-right" },

  // Prevent Next.js from bundling native binaries — they are loaded at runtime
  // from node_modules on the server and are not compatible with the webpack bundler.
  serverExternalPackages: ["ffmpeg-static", "ffprobe-static"],

  // Exclude FFmpeg/FFprobe binaries from Vercel's deployment trace.
  // These packages are only needed by the Railway worker, not the Next.js app.
  // Without this, the deployment would exceed Vercel's 50 MB function size limit.
  outputFileTracingExcludes: {
    "*": [
      "./node_modules/ffmpeg-static/**",
      "./node_modules/ffprobe-static/**",
    ],
  },
};

export default nextConfig;

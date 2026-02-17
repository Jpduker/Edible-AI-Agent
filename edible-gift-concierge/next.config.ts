import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Standalone output for Docker deployment */
  output: "standalone",

  /* Proxy all API routes to the Python FastAPI backend */
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
    return [
      {
        source: "/api/chat",
        destination: `${backendUrl}/api/chat`,
      },
      {
        source: "/api/search",
        destination: `${backendUrl}/api/search`,
      },
      {
        source: "/api/compare",
        destination: `${backendUrl}/api/compare`,
      },
    ];
  },
};

export default nextConfig;

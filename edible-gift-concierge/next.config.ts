import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Proxy all API routes to the Python FastAPI backend */
  async rewrites() {
    return [
      {
        source: "/api/chat",
        destination: "http://localhost:8000/api/chat",
      },
      {
        source: "/api/search",
        destination: "http://localhost:8000/api/search",
      },
      {
        source: "/api/compare",
        destination: "http://localhost:8000/api/compare",
      },
    ];
  },
};

export default nextConfig;

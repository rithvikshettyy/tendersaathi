const BACKEND = process.env.BACKEND_URL || "http://localhost:8000";

if (process.env.VERCEL && !process.env.BACKEND_URL) {
  console.warn(
    "[tendersaathi] BACKEND_URL is not set. /api/* will proxy to localhost and fail. " +
      "Set BACKEND_URL to your deployed FastAPI URL in the Vercel project settings.",
  );
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND.replace(/\/$/, "")}/api/:path*` }];
  },
};

export default nextConfig;

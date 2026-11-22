// Where /api/* is proxied. Override with BACKEND_URL (e.g. a staging backend).
// `next dev` talks to a local FastAPI; production builds default to the hosted backend.
const DEFAULT_BACKEND =
  process.env.NODE_ENV === "production" ? "https://tendersaathi.onrender.com" : "http://localhost:8000";
const BACKEND = (process.env.BACKEND_URL || DEFAULT_BACKEND).replace(/\/$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND}/api/:path*` }];
  },
};

export default nextConfig;

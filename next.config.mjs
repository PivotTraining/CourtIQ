/** @type {import('next').NextConfig} */
const nextConfig = {
  // Native packages must contain their web runtime. Capacitor reserves
  // server.url for live reload, so native builds use Next's static export.
  ...(process.env.CAPACITOR_BUILD === "true" ? { output: "export" } : {}),
  trailingSlash: process.env.CAPACITOR_BUILD === "true",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

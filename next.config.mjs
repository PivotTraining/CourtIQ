import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Never infer a workspace root from unrelated lockfiles above this repo.
  // Native exports and deployment traces must be reproducible from CourtIQ.
  outputFileTracingRoot: projectRoot,
  // Native packages must contain their web runtime. Capacitor reserves
  // server.url for live reload, so native builds use Next's static export.
  ...(process.env.CAPACITOR_BUILD === "true" ? { output: "export" } : {}),
  trailingSlash: process.env.CAPACITOR_BUILD === "true",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: projectRoot,
  // Local sample QA must not refill a nearly-full disk with a regenerable build cache.
  webpack(config) {
    if (process.env.COURTIQ_LOCAL_PREVIEW === 'true') config.cache = false;
    return config;
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

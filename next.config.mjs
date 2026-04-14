/** @type {import('next').NextConfig} */
const nextConfig = {
  // Removed output: "export" — static export breaks OAuth callbacks,
  // middleware, and server-side Supabase auth on Vercel.
  // Capacitor builds should use `next export` via a separate script if needed.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

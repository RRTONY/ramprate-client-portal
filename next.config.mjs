/** @type {import('next').NextConfig} */
const nextConfig = {
  // Browser tests build into their own folder so they never overwrite the real build.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};
export default nextConfig;

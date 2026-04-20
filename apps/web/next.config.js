/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@family-chat/shared", "@family-chat/ui"],
};

module.exports = nextConfig;

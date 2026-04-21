const path = require("node:path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@family-chat/shared", "@family-chat/ui"],
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
};

module.exports = nextConfig;

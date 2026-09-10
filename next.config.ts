import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/0910-1",
  assetPrefix: "/0910-1/",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
};

export default nextConfig;

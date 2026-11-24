import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // firebase-admin ต้องอยู่ฝั่ง server เท่านั้น
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;

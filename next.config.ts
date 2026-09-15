import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: process.cwd(),
  },
  transpilePackages: [
    "@pump-fun/pump-sdk",
    "@coral-xyz/anchor",
    "@solana/wallet-adapter-base",
    "@solana/wallet-adapter-react",
  ],
};

export default nextConfig;

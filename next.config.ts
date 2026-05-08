import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['unpdf'],
  async redirects() {
    return [
      { source: '/cadastro', destination: '/login', permanent: true },
    ]
  },
};

export default nextConfig;

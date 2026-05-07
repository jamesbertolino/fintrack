import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse'],
  async redirects() {
    return [
      { source: '/cadastro', destination: '/login', permanent: true },
    ]
  },
};

export default nextConfig;

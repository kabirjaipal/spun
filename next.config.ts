import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  compress: true,
  serverExternalPackages: ["pg", "bcryptjs"],
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "clsx", "tailwind-merge"],
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;

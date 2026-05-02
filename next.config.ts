import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@takaki/go-design-system",
      "@vercel/analytics",
      "@supabase/ssr",
      "@supabase/supabase-js",
    ],
  },
};

export default nextConfig;

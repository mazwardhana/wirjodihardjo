import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Output mandiri untuk image Docker yang ramping.
  output: "standalone",
  // Prisma tidak boleh di-bundle; biarkan dimuat dari node_modules saat runtime.
  serverExternalPackages: ["@prisma/client", "prisma", "@prisma/adapter-pg", "pg"],
  images: {
    // Foto keluarga disajikan dari object storage / URL mana pun yang tepercaya.
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  // Service worker tidak boleh di-cache lama: kalau tertahan di cache peramban
  // atau CDN, perbaikan PWA baru tidak pernah sampai ke perangkat yang sudah
  // memasang aplikasi.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
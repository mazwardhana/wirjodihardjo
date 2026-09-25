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
};

export default nextConfig;
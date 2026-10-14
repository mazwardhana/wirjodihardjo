import type { MetadataRoute } from "next";
import { PALET } from "@/lib/theme-tokens";

// Manifest dibuat dari token, bukan berkas JSON statis, supaya warna PWA tidak
// bisa melenceng dari palet lagi (dulu memakai palet lama yang berbeda).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Keluarga Besar Wirjodihardjo",
    short_name: "KB Wirjodihardjo",
    description:
      "Rumah digital keluarga besar Wirjodihardjo: silsilah interaktif, galeri kenangan, hall of fame, dan reuni keluarga.",
    lang: "id",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: PALET.cream,
    theme_color: PALET.forest,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}

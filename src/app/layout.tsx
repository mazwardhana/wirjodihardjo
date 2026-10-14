import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { MobileBottomNav } from "@/components/pwa/MobileBottomNav";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";
import { Providers } from "@/components/Providers";
import { ToastContainer } from "@/components/ui/Toast";
import { PALET } from "@/lib/theme-tokens";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Keluarga Besar Wirjodihardjo",
    template: "%s · Keluarga Besar Wirjodihardjo",
  },
  description:
    "Rumah digital keluarga besar Wirjodihardjo: silsilah interaktif, galeri kenangan, hall of fame, dan reuni keluarga.",
  // /manifest.webmanifest dilayani oleh src/app/manifest.ts.
  manifest: "/manifest.webmanifest",
  // Tanpa appleWebApp, iOS membuka PWA dengan bilah Safari dan status bar gaya
  // peramban. black-translucent menyatukan status bar dengan latar cream.
  // startupImage: tanpa ini iOS menampilkan layar putih polos saat aplikasi
  // dibuka dari layar utama. Berkas dibuat scripts/generate-logo.mjs.
  appleWebApp: {
    capable: true,
    title: "KB Wirjodihardjo",
    statusBarStyle: "black-translucent",
    startupImage: [
      { url: "/splash-430x932.png", media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)" },
      { url: "/splash-393x852.png", media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)" },
      { url: "/splash-390x844.png", media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)" },
      { url: "/splash-375x812.png", media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)" },
      { url: "/splash-414x896.png", media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)" },
      { url: "/splash-768x1024.png", media: "(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)" },
    ],
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  other: {
    // Sinyal lama yang masih dibaca iOS untuk mode standalone.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: PALET.forest,
  // Tanpa viewport-fit=cover, env(safe-area-inset-*) bernilai 0 di iPhone
  // sehingga nav bawah tertutup home indicator.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${fraunces.variable} ${jakarta.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-cream text-ink">
        <a
          href="#konten"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-forest focus:px-4 focus:py-2 focus:text-cream"
        >
          Lompat ke konten
        </a>
        <Providers>
          <Navbar />
          <main id="konten" className="flex-1">
            {children}
          </main>
          <Footer />
          <ToastContainer />
          <ServiceWorkerRegistration />
          <InstallPrompt />
          <MobileBottomNav />
        </Providers>
      </body>
    </html>
  );
}
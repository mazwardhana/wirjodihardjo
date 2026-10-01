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
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#1A4D2E",
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
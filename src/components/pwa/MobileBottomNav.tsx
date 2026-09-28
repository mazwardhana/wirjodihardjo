"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Rute yang tidak memakai nav member (admin, auth, onboarding).
const HIDDEN_PREFIXES = ["/admin", "/login", "/onboarding", "/sso"] as const;

function isHiddenPath(pathname: string): boolean {
  return HIDDEN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

// Beranda hanya aktif persis di /dashboard agar /dashboard/profil tidak ikut menyala.
function isActivePath(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function IconBeranda() {
  return (
    <NavIcon>
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.5 9.5V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5" />
      <path d="M10 21v-5h4v5" />
    </NavIcon>
  );
}

function IconSilsilah() {
  return (
    <NavIcon>
      <circle cx="12" cy="5" r="2" />
      <circle cx="5.5" cy="19" r="2" />
      <circle cx="18.5" cy="19" r="2" />
      <path d="M12 7v7" />
      <path d="M5.5 17v-3h13v3" />
    </NavIcon>
  );
}

function IconGaleri() {
  return (
    <NavIcon>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </NavIcon>
  );
}

function IconReuni() {
  return (
    <NavIcon>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20v-1.2a5.5 5.5 0 0 1 11 0V20" />
      <path d="M15.5 5.3a3.2 3.2 0 0 1 0 5.4" />
      <path d="M16.5 13.4a5.5 5.5 0 0 1 4 5.4V20" />
    </NavIcon>
  );
}

function IconProfil() {
  return (
    <NavIcon>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20v-.8a7 7 0 0 1 14 0v.8" />
    </NavIcon>
  );
}

const ITEMS = [
  { href: "/dashboard", label: "Beranda", icon: <IconBeranda /> },
  { href: "/silsilah", label: "Silsilah", icon: <IconSilsilah /> },
  { href: "/galeri", label: "Galeri", icon: <IconGaleri /> },
  { href: "/reuni", label: "Reuni", icon: <IconReuni /> },
  { href: "/dashboard/profil", label: "Profil", icon: <IconProfil /> },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const hidden = isHiddenPath(pathname);

  return (
    <nav
      aria-label="Navigasi bawah"
      hidden={hidden}
      className="member-bottom-nav fixed inset-x-0 bottom-0 z-[120] border-t border-wood/15 bg-cream/95 backdrop-blur-sm md:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5 px-1 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {ITEMS.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.href} className="relative">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-2 text-xs font-medium transition-colors",
                  active
                    ? "text-forest"
                    : "text-muted hover:bg-wood/10 hover:text-forest",
                )}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-2 top-0 h-0.5 rounded-full bg-gold"
                  />
                )}
                {item.icon}
                <span className="leading-none">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

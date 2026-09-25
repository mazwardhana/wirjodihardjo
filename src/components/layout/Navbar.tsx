"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/silsilah", label: "Silsilah" },
  { href: "/galeri", label: "Galeri" },
  { href: "/hall-of-fame", label: "Hall of Fame" },
  { href: "/reuni", label: "Reuni" },
  { href: "/tentang", label: "Tentang" },
] as const;

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Tutup menu saat pindah halaman
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Tutup dengan Escape (R-32)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-wood/15 bg-cream/90 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5"
          aria-label="Beranda Keluarga Besar Wirjodihardjo"
        >
          <span
            className="grid h-9 w-9 place-items-center rounded-md bg-forest font-display text-lg font-semibold text-cream"
            aria-hidden="true"
          >
            W
          </span>
          <span className="font-display text-lg font-semibold tracking-tight text-forest">
            Wirjodihardjo
          </span>
        </Link>

        <nav aria-label="Navigasi utama" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-forest/10 text-forest"
                        : "text-muted hover:bg-wood/10 hover:text-forest",
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/login"
            className="rounded-md border border-forest/30 px-4 py-2 text-sm font-semibold text-forest transition-colors hover:bg-forest hover:text-cream"
          >
            Masuk
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="menu-mobile"
          aria-label={open ? "Tutup menu" : "Buka menu"}
          className="grid h-11 w-11 place-items-center rounded-md text-forest hover:bg-wood/10 md:hidden"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            {open ? (
              <>
                <path d="M6 6l12 12" />
                <path d="M18 6L6 18" />
              </>
            ) : (
              <>
                <path d="M4 7h16" />
                <path d="M4 12h16" />
                <path d="M4 17h16" />
              </>
            )}
          </svg>
        </button>
      </div>

      {open && (
        <nav
          id="menu-mobile"
          aria-label="Navigasi mobile"
          className="border-t border-wood/15 bg-cream md:hidden"
        >
          <ul className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="block rounded-md px-3 py-3 text-base font-medium text-forest hover:bg-wood/10"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li className="mt-2 border-t border-wood/15 pt-3">
              <Link
                href="/login"
                className="block rounded-md bg-forest px-3 py-3 text-center text-base font-semibold text-cream"
              >
                Masuk
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
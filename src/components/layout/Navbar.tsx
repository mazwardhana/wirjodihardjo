"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { signOut, useSession } from "@/lib/auth-client";

const NAV_LINKS = [
  { href: "/silsilah", label: "Silsilah" },
  { href: "/galeri", label: "Galeri" },
  { href: "/hall-of-fame", label: "Hall of Fame" },
  { href: "/reuni", label: "Reuni" },
  { href: "/tentang", label: "Tentang" },
] as const;

function isAdmin(role?: string) {
  return role === "SUPER_ADMIN" || role === "BRANCH_ADMIN";
}

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { data: session, status } = useSession();

  const user = session?.user;
  const admin = isAdmin(user?.role);
  const homeHref = admin ? "/admin" : "/dashboard";

  function closeMenus() {
    setOpen(false);
    setMenuOpen(false);
  }

  // Tutup dengan Escape (R-32)
  useEffect(() => {
    if (!open && !menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, menuOpen]);

  // Tutup dropdown user saat klik di luar
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

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
                    onClick={closeMenus}
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
          {status === "loading" ? (
            <span className="h-11 w-11" aria-hidden="true" />
          ) : user ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-controls="menu-user"
                className="flex items-center gap-2 rounded-md py-1 pl-1 pr-2 text-sm font-medium text-forest transition-colors hover:bg-wood/10"
              >
                <Avatar
                  name={user.name ?? "Anggota"}
                  size="sm"
                  className="ring-1 ring-forest/20"
                />
                <span className="max-w-[10rem] truncate">{user.name}</span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {menuOpen && (
                <div
                  id="menu-user"
                  role="menu"
                  className="absolute right-0 mt-2 w-48 overflow-hidden rounded-md border border-wood/15 bg-cream py-1 shadow-sm"
                >
                  <Link
                    href={homeHref}
                    role="menuitem"
                    onClick={closeMenus}
                    className="block px-4 py-2 text-sm text-forest hover:bg-wood/10"
                  >
                    {admin ? "Panel Admin" : "Dashboard"}
                  </Link>
                  <Link
                    href="/dashboard/profil"
                    role="menuitem"
                    onClick={closeMenus}
                    className="block px-4 py-2 text-sm text-forest hover:bg-wood/10"
                  >
                    Profil
                  </Link>
                  <Link
                    href="/dashboard/notifikasi"
                    role="menuitem"
                    onClick={closeMenus}
                    className="block px-4 py-2 text-sm text-forest hover:bg-wood/10"
                  >
                    Notifikasi
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      closeMenus();
                      signOut({ callbackUrl: "/" });
                    }}
                    className="block w-full px-4 py-2 text-left text-sm text-wood hover:bg-wood/10"
                  >
                    Keluar
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              onClick={closeMenus}
              className="rounded-md border border-forest/30 px-4 py-2 text-sm font-semibold text-forest transition-colors hover:bg-forest hover:text-cream"
            >
              Masuk
            </Link>
          )}
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
                  onClick={closeMenus}
                  className="block rounded-md px-3 py-3 text-base font-medium text-forest hover:bg-wood/10"
                >
                  {link.label}
                </Link>
              </li>
            ))}

            {user ? (
              <>
                <li className="mt-2 border-t border-wood/15 pt-3">
                  <div className="flex items-center gap-3 px-3 pb-2">
                    <Avatar name={user.name ?? "Anggota"} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-forest">
                        {user.name}
                      </span>
                      <span className="block text-xs text-muted">
                        {admin ? "Admin" : "Anggota"}
                      </span>
                    </span>
                  </div>
                  <Link
                    href={homeHref}
                    onClick={closeMenus}
                    className="block rounded-md px-3 py-3 text-base font-medium text-forest hover:bg-wood/10"
                  >
                    {admin ? "Panel Admin" : "Dashboard"}
                  </Link>
                  <Link
                    href="/dashboard/profil"
                    onClick={closeMenus}
                    className="block rounded-md px-3 py-3 text-base font-medium text-forest hover:bg-wood/10"
                  >
                    Profil
                  </Link>
                  <Link
                    href="/dashboard/notifikasi"
                    onClick={closeMenus}
                    className="block rounded-md px-3 py-3 text-base font-medium text-forest hover:bg-wood/10"
                  >
                    Notifikasi
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      closeMenus();
                      signOut({ callbackUrl: "/" });
                    }}
                    className="block w-full rounded-md px-3 py-3 text-left text-base font-medium text-wood hover:bg-wood/10"
                  >
                    Keluar
                  </button>
                </li>
              </>
            ) : (
              <li className="mt-2 border-t border-wood/15 pt-3">
                <Link
                  href="/login"
                  onClick={closeMenus}
                  className="block rounded-md bg-forest px-3 py-3 text-center text-base font-semibold text-cream"
                >
                  Masuk
                </Link>
              </li>
            )}
          </ul>
        </nav>
      )}
    </header>
  );
}

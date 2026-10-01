"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/lib/auth-client";

type AdminNavItem = {
  href: string;
  label: string;
  icon: string;
  role: "ALL" | "SUPER_ONLY";
};

const primaryItems: AdminNavItem[] = [
  { href: "/admin", label: "Overview", icon: "◉", role: "ALL" },
  { href: "/admin/anggota", label: "Data Anggota", icon: "⊡", role: "ALL" },
  { href: "/admin/artikel", label: "Artikel", icon: "▤", role: "ALL" },
  { href: "/admin/pengajuan", label: "Pengajuan", icon: "⊞", role: "ALL" },
];

const overflowItems: AdminNavItem[] = [
  { href: "/admin/cabang", label: "Keluarga Cabang", icon: "⊟", role: "SUPER_ONLY" },
  { href: "/admin/keluarga", label: "Keluarga", icon: "⊕", role: "ALL" },
  { href: "/admin/galeri", label: "Galeri", icon: "⊠", role: "ALL" },
  { href: "/admin/hall-of-fame", label: "Hall of Fame", icon: "★", role: "ALL" },
  { href: "/admin/reuni", label: "Reuni", icon: "◈", role: "ALL" },
  { href: "/admin/pengguna", label: "Pengguna", icon: "☷", role: "SUPER_ONLY" },
  { href: "/admin/impor", label: "Impor Data", icon: "⇧", role: "SUPER_ONLY" },
  { href: "/admin/audit-log", label: "Audit Log", icon: "▦", role: "SUPER_ONLY" },
  { href: "/dashboard", label: "Dashboard", icon: "←", role: "ALL" },
];

const CABANG_HREF = "/admin/cabang";
const CABANG_SEGMENT = "/admin/keluarga/cabang";

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  // Sama seperti sidebar: entri "Keluarga Cabang" menyala juga di segmen terpadu.
  if (href === CABANG_HREF) {
    return (
      pathname === CABANG_HREF ||
      pathname.startsWith(`${CABANG_HREF}/`) ||
      pathname === CABANG_SEGMENT ||
      pathname.startsWith(`${CABANG_SEGMENT}/`)
    );
  }
  // "Keluarga" eksklusif: jangan menyala di segmen keluarga cabang terpadu.
  if (href === "/admin/keluarga") {
    const inCabangSegment =
      pathname === CABANG_SEGMENT || pathname.startsWith(`${CABANG_SEGMENT}/`);
    return !inCabangSegment && pathname.startsWith(href);
  }
  return pathname.startsWith(href);
}

export function MobileBottomNav({ role }: { role: string }) {
  const pathname = usePathname();
  return <MobileNavigation key={pathname} pathname={pathname} role={role} />;
}

function MobileNavigation({ pathname, role }: { pathname: string; role: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const trigger = menuButtonRef.current;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>("a, button")?.focus();

    const closeMenu = () => {
      setMenuOpen(false);
      trigger?.focus({ preventScroll: true });
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
      }
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) closeMenu();
    };
    const handleFocus = (event: FocusEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const desktop = window.matchMedia("(min-width: 1024px)");
    const handleResize = () => {
      if (desktop.matches) setMenuOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("focusin", handleFocus);
    desktop.addEventListener("change", handleResize);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("focusin", handleFocus);
      desktop.removeEventListener("change", handleResize);
      if (panel?.contains(document.activeElement) && trigger?.isConnected && trigger.getClientRects().length) {
        trigger.focus({ preventScroll: true });
      }
    };
  }, [menuOpen]);

  // UI-only: hide links whose page gate redirects BRANCH_ADMIN. The server-side checks stay as-is.
  const visible = (items: AdminNavItem[]) =>
    items.filter((item) => item.role === "ALL" || role === "SUPER_ADMIN");
  const overflow = visible(overflowItems);
  const primary = visible(primaryItems);

  const overflowActive = overflow.some((item) => isActive(pathname, item.href));

  return (
    <div ref={menuRef}>
      {menuOpen && (
        <nav
          ref={panelRef}
          className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-50 mx-3 max-h-[calc(100dvh-5rem-env(safe-area-inset-bottom))] overflow-y-auto overscroll-contain rounded-lg border border-wood/20 bg-cream p-2 shadow-xl lg:hidden"
          aria-label="Menu admin lainnya"
        >
          <ul className="space-y-1">
            {overflow.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm ${
                    isActive(pathname, item.href)
                      ? "bg-forest/10 font-semibold text-forest"
                      : "text-muted hover:bg-wood/5 hover:text-forest"
                  }`}
                >
                  <span className="w-5 text-center text-xs">{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted hover:bg-wood/5 hover:text-forest"
              >
                <span className="w-5 text-center text-xs">⏻</span>
                Keluar
              </button>
            </li>
          </ul>
        </nav>
      )}

      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-wood/20 bg-cream pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Navigasi admin seluler"
      >
        <ul className="flex items-stretch">
          {primary.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2 text-xs ${
                    active ? "font-semibold text-forest" : "text-muted"
                  }`}
                >
                  <span className="text-base leading-none" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label="Buka menu lainnya"
              className={`flex min-h-[56px] w-full flex-col items-center justify-center gap-1 px-1 py-2 text-xs ${
                overflowActive || menuOpen ? "font-semibold text-forest" : "text-muted"
              }`}
            >
              <span className="text-base leading-none" aria-hidden="true">
                ☰
              </span>
              <span>Menu</span>
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

const primaryItems = [
  { href: "/admin", label: "Overview", icon: "◉" },
  { href: "/admin/anggota", label: "Anggota", icon: "⊡" },
  { href: "/admin/artikel", label: "Artikel", icon: "▤" },
  { href: "/admin/pengajuan", label: "Pengajuan", icon: "⊞" },
];

const overflowItems = [
  { href: "/admin/cabang", label: "Cabang", icon: "⊟" },
  { href: "/admin/galeri", label: "Galeri", icon: "⊠" },
  { href: "/admin/hall-of-fame", label: "Hall of Fame", icon: "★" },
  { href: "/admin/reuni", label: "Reuni", icon: "☰" },
  { href: "/admin/pengguna", label: "Pengguna", icon: "☷" },
  { href: "/admin/impor", label: "Impor Data", icon: "⇧" },
  { href: "/admin/audit-log", label: "Audit Log", icon: "☰" },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname.startsWith(href);
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(() => {
      setMenuOpen(false);
    });
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    const clickHandler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    window.addEventListener("mousedown", clickHandler);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("mousedown", clickHandler);
    };
  }, [menuOpen]);

  const overflowActive = overflowItems.some((item) => isActive(pathname, item.href));

  return (
    <div ref={menuRef}>
      {menuOpen && (
        <div
          className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-50 mx-3 rounded-lg border border-wood/20 bg-cream p-2 shadow-xl lg:hidden"
          role="menu"
          aria-label="Menu admin lainnya"
        >
          <ul className="space-y-1">
            {overflowItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  role="menuitem"
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
          </ul>
        </div>
      )}

      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-wood/20 bg-cream pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Navigasi admin seluler"
      >
        <ul className="flex items-stretch">
          {primaryItems.map((item) => {
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
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
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

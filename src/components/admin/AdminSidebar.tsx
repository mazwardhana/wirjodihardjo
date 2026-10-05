"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/auth-client";

const menu = [
  { href: "/admin", label: "Overview", icon: "◉", role: "ALL" as const },
  { href: "/admin/pengajuan", label: "Pengajuan", icon: "⊞", role: "ALL" as const },
  { href: "/admin/anggota", label: "Data Anggota", icon: "⊡", role: "ALL" as const },
  { href: "/admin/cabang", label: "Keluarga Cabang", icon: "⊟", role: "SUPER_ONLY" as const },
  { href: "/admin/keluarga", label: "Keluarga", icon: "⊕", role: "ALL" as const },
  { href: "/admin/galeri", label: "Galeri", icon: "⊠", role: "ALL" as const },
  { href: "/admin/hall-of-fame", label: "Hall of Fame", icon: "★", role: "ALL" as const },
  { href: "/admin/artikel", label: "Artikel", icon: "▤", role: "ALL" as const },
  { href: "/admin/pengurus", label: "Kepengurusan", icon: "⌘", role: "SUPER_ONLY" as const },
  { href: "/admin/impor", label: "Impor Data", icon: "⇧", role: "SUPER_ONLY" as const },
  { href: "/admin/registrasi", label: "Registrasi", icon: "✎", role: "SUPER_ONLY" as const },
  { href: "/admin/reuni", label: "Reuni", icon: "◈", role: "ALL" as const },
  { href: "/admin/statistik", label: "Statistik", icon: "◔", role: "SUPER_ONLY" as const },
  { href: "/admin/pengguna", label: "Pengguna", icon: "☷", role: "SUPER_ONLY" as const },
  { href: "/admin/audit-log", label: "Audit Log", icon: "▦", role: "SUPER_ONLY" as const },
];

const CABANG_HREF = "/admin/cabang";
const CABANG_SEGMENT = "/admin/keluarga/cabang";

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  // "Keluarga Cabang" nav entry lights on both the legacy /admin/cabang route (which now
  // redirects to the unified segment) and the unified /admin/keluarga/cabang segment.
  if (href === CABANG_HREF) {
    return (
      pathname === CABANG_HREF ||
      pathname.startsWith(`${CABANG_HREF}/`) ||
      pathname === CABANG_SEGMENT ||
      pathname.startsWith(`${CABANG_SEGMENT}/`)
    );
  }
  // "Keluarga" stays exclusive: do not light when the unified cabang segment
  // is active, since that belongs to the "Keluarga Cabang" entry.
  if (href === "/admin/keluarga") {
    const inCabangSegment =
      pathname === CABANG_SEGMENT || pathname.startsWith(`${CABANG_SEGMENT}/`);
    return !inCabangSegment && (pathname === href || pathname.startsWith(`${href}/`));
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar({ role, fullName }: { role: string; fullName: string }) {
  const pathname = usePathname();
  // UI-only: hide links whose page gate redirects BRANCH_ADMIN. The server-side checks stay as-is.
  const items = menu.filter((item) => item.role === "ALL" || role === "SUPER_ADMIN");

  return (
    <aside className="hidden w-64 flex-col border-r border-wood/15 bg-cream lg:flex">
      {/* Brand */}
      <div className="flex items-center gap-3 border-b border-wood/15 px-5 py-5">
        <div className="grid h-9 w-9 place-items-center rounded-md bg-forest text-sm font-bold text-cream">
          W
        </div>
        <div>
          <p className="text-sm font-semibold text-forest">Admin</p>
          <p className="text-[10px] uppercase tracking-wide text-muted">
            {role === "SUPER_ADMIN" ? "Super Admin" : "Admin Keluarga Cabang"}
          </p>
        </div>
      </div>

      {/* Nama admin */}
      <div className="border-b border-wood/10 px-5 py-3">
        <p className="text-xs text-muted">{fullName}</p>
      </div>

      {/* Menu */}
      <nav className="flex-1 overflow-y-auto p-3" aria-label="Navigasi admin">
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
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
      </nav>

      {/* Footer */}
      <div className="border-t border-wood/15 px-5 py-4">
        <Link
          href="/dashboard"
          className="mb-2 block text-xs text-muted underline hover:text-forest"
        >
          ← Dashboard
        </Link>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="text-xs text-muted underline hover:text-wood"
        >
          Keluar
        </button>
      </div>
    </aside>
  );
}
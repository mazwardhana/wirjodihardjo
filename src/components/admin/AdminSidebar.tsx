"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/auth-client";

const menu = [
  { href: "/admin", label: "Overview", icon: "◉" },
  { href: "/admin/pengajuan", label: "Pengajuan", icon: "⊞" },
  { href: "/admin/anggota", label: "Data Anggota", icon: "⊡" },
  { href: "/admin/cabang", label: "Cabang", icon: "⊟" },
  { href: "/admin/galeri", label: "Galeri", icon: "⊠" },
  { href: "/admin/hall-of-fame", label: "Hall of Fame", icon: "★" },
  { href: "/admin/artikel", label: "Artikel", icon: "▤" },
  { href: "/admin/impor", label: "Impor Data", icon: "⇧" },
  { href: "/admin/reuni", label: "Reuni", icon: "☰" },
  { href: "/admin/pengguna", label: "Pengguna", icon: "☷" },
  { href: "/admin/audit-log", label: "Audit Log", icon: "☰" },
];

export function AdminSidebar({ role, fullName }: { role: string; fullName: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 flex-col border-r border-wood/15 bg-cream">
      {/* Brand */}
      <div className="flex items-center gap-3 border-b border-wood/15 px-5 py-5">
        <div className="grid h-9 w-9 place-items-center rounded-md bg-forest text-sm font-bold text-cream">
          W
        </div>
        <div>
          <p className="text-sm font-semibold text-forest">Admin</p>
          <p className="text-[10px] uppercase tracking-wide text-muted">
            {role === "SUPER_ADMIN" ? "Super Admin" : "Admin Cabang"}
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
          {menu.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  pathname === item.href
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
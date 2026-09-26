"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/ui/Toast";

export type PenggunaListUser = {
  id: string;
  email: string;
  role: "SUPER_ADMIN" | "BRANCH_ADMIN" | "MEMBER";
  isActive: boolean;
  isVerified: boolean;
  person: { id: string; fullName: string } | null;
};

const roleLabels: Record<PenggunaListUser["role"], string> = {
  SUPER_ADMIN: "Super Admin",
  BRANCH_ADMIN: "Admin Cabang",
  MEMBER: "Anggota",
};

export function PenggunaList({ users }: { users: PenggunaListUser[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function updateUser(id: string, fields: Record<string, unknown>) {
    setBusy(`${id}:${Object.keys(fields)[0]}`);
    try {
      const response = await fetch("/api/admin/pengguna", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...fields }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Gagal memperbarui pengguna.");
      toast("success", "Data pengguna diperbarui.");
      router.refresh();
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "Gagal memperbarui pengguna.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-forest">Daftar akun</h2>
        <Link
          href="/admin/pengguna/baru"
          className="rounded-md bg-gold px-4 py-2.5 text-sm font-semibold text-forest transition-colors hover:bg-gold-deep"
        >
          Tambah pengguna
        </Link>
      </div>

      {users.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Belum ada pengguna"
            description="Akun pengguna yang dibuat akan tampil di halaman ini."
            action={
              <Link
                href="/admin/pengguna/baru"
                className="inline-block rounded-md bg-gold px-4 py-2.5 text-sm font-semibold text-forest"
              >
                Buat akun
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-md border border-wood/15">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-parchment/50">
              <tr className="border-b border-wood/15 text-xs font-medium uppercase tracking-wide text-muted">
                <th className="px-4 py-3 pr-6">Nama</th>
                <th className="px-4 py-3 pr-6">Email</th>
                <th className="px-4 py-3 pr-6">Peran</th>
                <th className="px-4 py-3 pr-6">Status</th>
                <th className="px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const name = user.person?.fullName ?? "Anggota tanpa profil";
                const roleBusy = busy === `${user.id}:role`;
                const activeBusy = busy === `${user.id}:isActive`;
                const verifiedBusy = busy === `${user.id}:isVerified`;

                return (
                  <tr key={user.id} className="border-b border-wood/10 last:border-0">
                    <td className="px-4 py-3 pr-6 font-medium text-forest">
                      <Link
                        href={`/admin/pengguna/${user.id}`}
                        className="underline decoration-wood/40 underline-offset-2 hover:text-gold-deep"
                      >
                        {name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 pr-6 text-muted">{user.email}</td>
                    <td className="px-4 py-3 pr-6">
                      <label className="sr-only" htmlFor={`role-${user.id}`}>
                        Peran {name}
                      </label>
                      <select
                        id={`role-${user.id}`}
                        value={user.role}
                        disabled={busy !== null}
                        onChange={(event) => updateUser(user.id, { role: event.target.value })}
                        className="rounded-md border border-wood/25 bg-cream px-2.5 py-1.5 text-xs text-forest focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30 disabled:opacity-50"
                      >
                        {(Object.keys(roleLabels) as PenggunaListUser["role"][]).map((role) => (
                          <option key={role} value={role}>
                            {roleLabels[role]}
                          </option>
                        ))}
                      </select>
                      {roleBusy && <span className="ml-2 text-xs text-muted">Menyimpan...</span>}
                    </td>
                    <td className="px-4 py-3 pr-6">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <button
                          type="button"
                          onClick={() => updateUser(user.id, { isActive: !user.isActive })}
                          disabled={busy !== null}
                          className={`text-xs font-semibold underline underline-offset-2 disabled:opacity-50 ${user.isActive ? "text-forest" : "text-wood"}`}
                        >
                          {activeBusy ? "Menyimpan..." : user.isActive ? "Aktif" : "Nonaktif"}
                        </button>
                        <button
                          type="button"
                          onClick={() => updateUser(user.id, { isVerified: !user.isVerified })}
                          disabled={busy !== null}
                          className={`text-xs underline underline-offset-2 disabled:opacity-50 ${user.isVerified ? "text-forest" : "text-muted"}`}
                        >
                          {verifiedBusy ? "Menyimpan..." : user.isVerified ? "Terverifikasi" : "Verifikasi"}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/pengguna/${user.id}`}
                        className="text-xs font-semibold text-gold-deep underline underline-offset-2 hover:text-forest"
                      >
                        Detail
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

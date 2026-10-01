"use client";

import { toast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Branch = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  coverImageUrl: string | null;
  orderIndex: number;
  isActive: boolean;
  rootPerson: { id: string; fullName: string } | null;
  admin: { id: string; email: string | null; role: string; person: { fullName: string } } | null;
  _count: { members: number };
};

export function CabangCard({ branch }: { branch: Branch }) {
  const router = useRouter();

  async function handleDeactivate() {
    if (!confirm(`Nonaktifkan keluarga cabang "${branch.name}"? Data anggota tetap tersimpan.`)) return;
    try {
      const res = await fetch(`/api/admin/cabang?id=${branch.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? "Gagal menonaktifkan");
      }
      toast("success", "Keluarga Cabang dinonaktifkan.");
      router.refresh();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Gagal menonaktifkan");
    }
  }

  async function handleActivate() {
    try {
      const res = await fetch("/api/admin/cabang", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: branch.id, isActive: true }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? "Gagal mengaktifkan");
      }
      toast("success", "Keluarga Cabang diaktifkan.");
      router.refresh();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Gagal mengaktifkan");
    }
  }

  return (
    <div
      className={`rounded-lg border ${
        branch.isActive ? "border-wood/15 bg-cream" : "border-muted/20 bg-muted/5 opacity-70"
      } p-4 transition-colors`}
    >
      {branch.coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={branch.coverImageUrl}
          alt=""
          className="mb-3 h-24 w-full rounded-md object-cover"
        />
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-forest">
            {branch.name}
            {!branch.isActive && (
              <span className="ml-2 rounded-full bg-muted/15 px-2 py-0.5 text-[10px] font-medium text-muted">
                Nonaktif
              </span>
            )}
          </p>
          {branch.rootPerson && (
            <p className="truncate text-sm text-muted">
              Akar: {branch.rootPerson.fullName}
            </p>
          )}
          <p className="text-xs text-muted">
            {branch.admin
              ? `Admin: ${branch.admin.person.fullName}${branch.admin.email ? ` (${branch.admin.email})` : ""}`
              : "Belum ada admin"}{" "}
            &middot; {branch._count.members} anggota
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/admin/keluarga/cabang/${branch.id}`}
          className="inline-flex min-h-11 items-center rounded-md bg-forest px-3 py-1.5 text-xs font-semibold text-cream transition-colors hover:bg-forest-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          Kelola
        </Link>
        {branch.isActive ? (
          <button
            type="button"
            onClick={handleDeactivate}
            className="min-h-11 rounded-md border border-wood/30 px-3 py-1.5 text-xs text-muted transition-colors hover:bg-wood/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            Nonaktifkan
          </button>
        ) : (
          <button
            type="button"
            onClick={handleActivate}
            className="min-h-11 rounded-md border border-forest/30 px-3 py-1.5 text-xs text-forest transition-colors hover:bg-forest/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            Aktifkan
          </button>
        )}
      </div>
    </div>
  );
}
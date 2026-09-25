"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Avatar } from "@/components/ui/Avatar";

export type HallOfFameEntry = {
  id: string;
  category: string;
  title: string;
  description: string;
  year: number | null;
  photoUrl: string | null;
  entryType: "ACHIEVEMENT" | "IN_MEMORIAM";
  isPublished: boolean;
  person: { id: string; fullName: string; photoUrl: string | null };
};

const selectCls =
  "rounded-md border border-wood/30 bg-cream px-3 py-2 text-sm text-forest focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30";

const entryTypeLabels: Record<HallOfFameEntry["entryType"], string> = {
  ACHIEVEMENT: "Prestasi",
  IN_MEMORIAM: "In Memoriam",
};

export function HallOfFameList({
  entries,
  categories,
  filters,
  total,
}: {
  entries: HallOfFameEntry[];
  categories: string[];
  filters: { category: string; status: string };
  total: number;
}) {
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<HallOfFameEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  function applyFilter(next: { category?: string; status?: string }) {
    const params = new URLSearchParams();
    const category = next.category ?? filters.category;
    const status = next.status ?? filters.status;
    if (category) params.set("kategori", category);
    if (status && status !== "all") params.set("status", status);
    router.push(`/admin/hall-of-fame${params.size ? `?${params}` : ""}`);
  }

  async function togglePublish(entry: HallOfFameEntry) {
    setBusyId(entry.id);
    try {
      const res = await fetch("/api/admin/hall-of-fame", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id, isPublished: !entry.isPublished }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Gagal mengubah status");
      }
      toast("success", entry.isPublished ? "Entri disembunyikan." : "Entri diterbitkan.");
      router.refresh();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Gagal mengubah status");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/admin/hall-of-fame?id=${encodeURIComponent(deleteTarget.id)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Gagal menghapus");
      }
      toast("success", "Entri dihapus.");
      setDeleteTarget(null);
      router.refresh();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Gagal menghapus");
    } finally {
      setDeleting(false);
    }
  }

  const filtering = filters.category !== "" || filters.status !== "all";

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          <span>Kategori</span>
          <select
            value={filters.category}
            onChange={(e) => applyFilter({ category: e.target.value })}
            className={selectCls}
          >
            <option value="">Semua</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-muted">
          <span>Status</span>
          <select
            value={filters.status}
            onChange={(e) => applyFilter({ status: e.target.value })}
            className={selectCls}
          >
            <option value="all">Semua</option>
            <option value="published">Terbit</option>
            <option value="draft">Draf</option>
          </select>
        </label>

        {filtering && (
          <Link
            href="/admin/hall-of-fame"
            className="rounded-md border border-wood/30 px-4 py-2 text-sm text-muted transition-colors hover:bg-wood/10"
          >
            Reset
          </Link>
        )}

        <p className="ml-auto text-sm text-muted">
          {entries.length} dari {total} entri
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-wood/25 bg-cream px-4 py-12 text-center text-muted">
          {filtering
            ? "Tidak ada entri yang cocok dengan filter."
            : "Belum ada entri. Tambahkan entri pertama."}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-wood/15">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Daftar entri Hall of Fame</caption>
            <thead>
              <tr className="border-b border-wood/15 bg-parchment/40 text-xs font-medium text-muted">
                <th scope="col" className="px-4 py-3">Entri</th>
                <th scope="col" className="px-4 py-3">Anggota</th>
                <th scope="col" className="px-4 py-3">Kategori</th>
                <th scope="col" className="px-4 py-3">Tahun</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-wood/10 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={entry.title}
                        photoUrl={entry.photoUrl}
                        size="sm"
                      />
                      <div>
                        <Link
                          href={`/admin/hall-of-fame/${entry.id}`}
                          className="font-semibold text-forest hover:text-gold-deep"
                        >
                          {entry.title}
                        </Link>
                        <p className="text-xs text-muted">
                          {entryTypeLabels[entry.entryType]}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/anggota/${entry.person.id}`}
                      className="text-muted underline hover:text-forest"
                    >
                      {entry.person.fullName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{entry.category}</td>
                  <td className="px-4 py-3 text-muted">{entry.year ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                        entry.isPublished
                          ? "bg-forest/10 text-forest"
                          : "bg-muted/15 text-muted"
                      }`}
                    >
                      {entry.isPublished ? "Terbit" : "Draf"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <Link
                        href={`/admin/hall-of-fame/${entry.id}`}
                        className="text-xs font-medium text-gold-deep underline hover:text-forest"
                      >
                        Ubah
                      </Link>
                      <button
                        type="button"
                        onClick={() => togglePublish(entry)}
                        disabled={busyId === entry.id}
                        className="text-xs font-medium text-muted underline hover:text-forest disabled:opacity-50"
                      >
                        {busyId === entry.id
                          ? "Memproses..."
                          : entry.isPublished
                            ? "Sembunyikan"
                            : "Terbitkan"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(entry)}
                        className="text-xs font-medium text-wood underline hover:text-wood-soft"
                      >
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Entri"
        message={`Entri "${deleteTarget?.title}" akan dihapus permanen.`}
        confirmLabel={deleting ? "Menghapus..." : "Ya, hapus"}
      />
    </>
  );
}
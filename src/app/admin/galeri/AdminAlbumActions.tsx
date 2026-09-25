"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

/**
 * Tindakan baris album: terbitkan/tarik, hapus. Album sendiri
 * diedit di halaman detailnya.
 */
export function AdminAlbumActions({
  albumId,
  slug,
  title,
  isPublished,
}: {
  albumId: string;
  slug: string;
  title: string;
  isPublished: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function togglePublish() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/galeri", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: albumId, isPublished: !isPublished }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal mengubah status");
      toast("success", isPublished ? "Album ditarik dari publik" : "Album diterbitkan");
      router.refresh();
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/galeri?id=${encodeURIComponent(albumId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal menghapus album");
      toast("success", "Album dihapus");
      router.refresh();
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Link
        href={`/admin/galeri/${slug}`}
        className="rounded-md border border-wood/30 px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-wood/10"
      >
        Kelola
      </Link>
      <button
        type="button"
        onClick={togglePublish}
        disabled={busy}
        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
          isPublished
            ? "border border-wood/30 text-wood hover:bg-wood/10"
            : "bg-forest text-cream hover:bg-forest-soft"
        }`}
      >
        {isPublished ? "Tarik" : "Terbitkan"}
      </button>
      <button
        type="button"
        onClick={() => setConfirmDelete(true)}
        disabled={busy}
        aria-label={`Hapus album ${title}`}
        className="rounded-md border border-wood/20 px-3 py-1.5 text-xs text-muted transition-colors hover:bg-wood/10 disabled:opacity-50"
      >
        Hapus
      </button>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        title="Hapus album"
        message={`Album "${title}" beserta seluruh media di dalamnya akan dihapus permanen.`}
      />
    </div>
  );
}
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "@/components/ui/Toast";
import { AlbumForm } from "@/components/admin/AlbumForm";
import { MediaModeration, type ModerateMedia } from "@/components/admin/MediaModeration";
import { MediaUploader } from "@/components/admin/MediaUploader";
import { formatDate } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type AlbumData = {
  id: string;
  title: string;
  slug: string;
  description: string;
  eventDate: string;
  coverImageUrl: string | null;
  isPublished: boolean;
  createdAt: string;
  createdByName: string | null;
  publishedByName: string | null;
  publishedAt: string | null;
};

export function AdminAlbumDetailClient({
  album,
  media,
}: {
  album: AlbumData;
  media: ModerateMedia[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [showUploader, setShowUploader] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const pendingCount = media.filter((m) => m.status === "PENDING").length;

  async function togglePublish() {
    try {
      const res = await fetch("/api/admin/galeri", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: album.id, isPublished: !album.isPublished }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal mengubah status");
      toast("success", album.isPublished ? "Album ditarik dari publik" : "Album diterbitkan");
      router.refresh();
    } catch (e) {
      toast("error", (e as Error).message);
    }
  }

  async function removeAlbum() {
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/admin/galeri?id=${encodeURIComponent(album.id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal menghapus album");
      toast("success", "Album dihapus");
      router.push("/admin/galeri");
      router.refresh();
    } catch (e) {
      toast("error", (e as Error).message);
      setDeleteBusy(false);
    }
  }

  if (editing) {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-2xl font-semibold text-forest">Edit Album</h1>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-md border border-wood/30 px-4 py-2 text-sm text-muted transition-colors hover:bg-wood/10"
          >
            Kembali
          </button>
        </div>
        <div className="max-w-xl">
          <AlbumForm
            initial={{
              id: album.id,
              title: album.title,
              slug: album.slug,
              description: album.description,
              eventDate: album.eventDate,
              coverImageUrl: album.coverImageUrl,
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/galeri"
              className="text-sm text-muted underline-offset-2 hover:underline"
            >
              ← Galeri
            </Link>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                album.isPublished
                  ? "bg-forest/10 text-forest"
                  : "bg-gold/20 text-gold-deep"
              }`}
            >
              {album.isPublished ? "Terbit" : "Draf"}
            </span>
          </div>
          <h1 className="mt-2 font-display text-2xl font-semibold text-forest">
            {album.title}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {album.eventDate && formatDate(album.eventDate)}
            {album.createdByName && ` · Dibuat oleh ${album.createdByName}`}
            {album.publishedByName &&
              ` · Diterbitkan oleh ${album.publishedByName}`}
            {album.description && (
              <span className="mt-1 block max-w-xl">{album.description}</span>
            )}
          </p>
          {pendingCount > 0 && (
            <p className="mt-2 text-sm font-medium text-gold-deep">
              {pendingCount} media menunggu moderasi
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={togglePublish}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
              album.isPublished
                ? "border border-wood/30 text-wood hover:bg-wood/10"
                : "bg-forest text-cream hover:bg-forest-soft"
            }`}
          >
            {album.isPublished ? "Tarik dari Publik" : "Terbitkan"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md border border-wood/30 px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-wood/10"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={deleteBusy}
            className="rounded-md border border-wood/20 px-4 py-2 text-sm text-muted transition-colors hover:bg-wood/10 disabled:opacity-50"
          >
            Hapus
          </button>
        </div>
      </div>

      <div className="mb-8">
        {showUploader ? (
          <div className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-forest">
                Unggah Media Baru
              </h2>
              <button
                type="button"
                onClick={() => setShowUploader(false)}
                className="rounded-md border border-wood/30 px-3 py-1.5 text-xs text-muted transition-colors hover:bg-wood/10"
              >
                Tutup
              </button>
            </div>
            <MediaUploader albumId={album.id} />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowUploader(true)}
            className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-forest transition-colors hover:bg-gold-deep"
          >
            + Unggah Media
          </button>
        )}
      </div>

      <h2 className="font-display text-lg font-semibold text-forest">
        Media ({media.length})
      </h2>
      <p className="text-sm text-muted">
        Setujui atau tolak media yang menunggu, atau kelola media yang sudah dimoderasi.
      </p>

      <div className="mt-4">
        <MediaModeration media={media} />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={removeAlbum}
        title="Hapus album"
        message={`Album "${album.title}" beserta ${media.length} media di dalamnya akan dihapus permanen.`}
      />
    </>
  );
}
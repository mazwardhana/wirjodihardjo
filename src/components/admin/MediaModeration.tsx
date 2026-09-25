"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/States";

export type ModerateMedia = {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  caption: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  createdAt: string;
  uploader: { fullName: string } | null;
};

type Filter = "ALL" | "PENDING" | "APPROVED" | "REJECTED";

const statusStyle: Record<string, string> = {
  PENDING: "bg-gold/20 text-gold-deep",
  APPROVED: "bg-forest/10 text-forest",
  REJECTED: "bg-wood/15 text-wood",
};

const statusLabel: Record<string, string> = {
  PENDING: "Tertunda",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
};

export function MediaModeration({ media }: { media: ModerateMedia[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const counts = {
    ALL: media.length,
    PENDING: media.filter((m) => m.status === "PENDING").length,
    APPROVED: media.filter((m) => m.status === "APPROVED").length,
    REJECTED: media.filter((m) => m.status === "REJECTED").length,
  };

  const visible = filter === "ALL" ? media : media.filter((m) => m.status === filter);

  async function moderate(id: string, status: "APPROVED" | "REJECTED", rejectionReason?: string) {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/media", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, rejectionReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal memoderasi");
      toast("success", status === "APPROVED" ? "Media disetujui" : "Media ditolak");
      setRejectingId(null);
      setReason("");
      router.refresh();
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/media?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal menghapus");
      toast("success", "Media dihapus");
      router.refresh();
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setBusyId(null);
      setDeletingId(null);
    }
  }

  const tabs: { key: Filter; label: string }[] = [
    { key: "ALL", label: "Semua" },
    { key: "PENDING", label: "Tertunda" },
    { key: "APPROVED", label: "Disetujui" },
    { key: "REJECTED", label: "Ditolak" },
  ];

  return (
    <div>
      <div className="flex gap-1 rounded-lg border border-wood/15 bg-cream p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFilter(t.key)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === t.key ? "bg-forest text-cream" : "text-muted hover:bg-wood/10"
            }`}
          >
            {t.label}
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                filter === t.key ? "bg-cream/20" : "bg-forest/10"
              }`}
            >
              {counts[t.key]}
            </span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Tidak ada media"
            description={
              filter === "ALL"
                ? "Belum ada media di album ini. Unggah foto untuk mulai mengisi album."
                : "Tidak ada media dengan status ini."
            }
          />
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((m) => (
            <li key={m.id} className="overflow-hidden rounded-lg border border-wood/15 bg-cream">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={m.thumbnailUrl || m.url}
                alt={m.caption ?? "Media album"}
                loading="lazy"
                className={`h-44 w-full object-cover ${m.status === "REJECTED" ? "opacity-50 grayscale" : ""}`}
              />
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-forest">
                    {m.caption ?? "Tanpa keterangan"}
                  </p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusStyle[m.status]}`}
                  >
                    {statusLabel[m.status]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  Diunggah {m.uploader?.fullName ?? "?"} ·{" "}
                  {new Date(m.createdAt).toLocaleDateString("id-ID")}
                </p>

                {m.status === "REJECTED" && m.rejectionReason && (
                  <p className="mt-2 rounded bg-wood/10 p-2 text-xs text-wood">
                    Alasan: {m.rejectionReason}
                  </p>
                )}

                {rejectingId === m.id ? (
                  <div className="mt-3 space-y-2">
                    <label
                      htmlFor={`reason-${m.id}`}
                      className="block text-xs font-medium text-muted"
                    >
                      Alasan penolakan
                    </label>
                    <textarea
                      id={`reason-${m.id}`}
                      rows={2}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="block w-full rounded-md border border-wood/25 bg-cream px-3 py-2 text-sm text-forest placeholder:text-muted/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
                      placeholder="Mis: Foto buram"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={!reason.trim() || busyId === m.id}
                        onClick={() => moderate(m.id, "REJECTED", reason.trim())}
                        className="rounded-md bg-wood px-3 py-1.5 text-xs font-semibold text-cream transition-colors hover:bg-wood-soft disabled:opacity-50"
                      >
                        {busyId === m.id ? "Menolak…" : "Tolak"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRejectingId(null);
                          setReason("");
                        }}
                        className="rounded-md border border-wood/30 px-3 py-1.5 text-xs text-muted transition-colors hover:bg-wood/10"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {m.status !== "APPROVED" && (
                      <button
                        type="button"
                        disabled={busyId === m.id}
                        onClick={() => moderate(m.id, "APPROVED")}
                        className="rounded-md bg-forest px-3 py-1.5 text-xs font-semibold text-cream transition-colors hover:bg-forest-soft disabled:opacity-50"
                      >
                        {busyId === m.id ? "Menyetujui…" : "Setujui"}
                      </button>
                    )}
                    {m.status !== "REJECTED" && (
                      <button
                        type="button"
                        disabled={busyId === m.id}
                        onClick={() => {
                          setRejectingId(m.id);
                          setReason("");
                        }}
                        className="rounded-md border border-wood/30 px-3 py-1.5 text-xs font-medium text-wood transition-colors hover:bg-wood/10 disabled:opacity-50"
                      >
                        Tolak
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busyId === m.id}
                      onClick={() => setDeletingId(m.id)}
                      className="rounded-md border border-wood/20 px-3 py-1.5 text-xs text-muted transition-colors hover:bg-wood/10 disabled:opacity-50"
                    >
                      Hapus
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deletingId !== null}
        onClose={() => setDeletingId(null)}
        onConfirm={() => deletingId && remove(deletingId)}
        title="Hapus media"
        message="Berkas media ini akan dihapus permanen dari album."
      />
    </div>
  );
}

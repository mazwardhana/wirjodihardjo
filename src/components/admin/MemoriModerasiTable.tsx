"use client";

import { useCallback, useEffect, useState } from "react";
import { FiFileText, FiMic, FiFile, FiImage, FiRefreshCw } from "react-icons/fi";
import { toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type MemoryRow = {
  id: string;
  kind: string;
  title: string;
  content: string | null;
  fileUrl: string | null;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
  uploader: { username: string } | null;
  person: { id: string; fullName: string } | null;
};

const KIND_LABEL: Record<string, string> = {
  STORY: "Cerita",
  AUDIO: "Audio",
  DOCUMENT: "Dokumen",
  IMAGE: "Gambar",
};

const KIND_ICON: Record<string, typeof FiFileText> = {
  STORY: FiFileText,
  AUDIO: FiMic,
  DOCUMENT: FiFile,
  IMAGE: FiImage,
};

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-gold/20 text-gold-deep",
  REJECTED: "bg-wood/15 text-wood",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Menunggu",
  REJECTED: "Ditolak",
};

/**
 * Daftar memori yang menunggu moderasi. Data diambil dari
 * GET /api/admin/memories agar penjagaan cabang selalu satu sumber dengan
 * route, bukan disalin ke server component.
 */
export function MemoriModerasiTable() {
  const [rows, setRows] = useState<MemoryRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/memories");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Gagal memuat daftar memori");
      setRows(data.memories as MemoryRow[]);
    } catch (e) {
      toast("error", (e as Error).message);
      setRows([]);
    }
  }, []);

  useEffect(() => {
    // Dijalankan lewat tunda singkat agar setState tidak sinkron di badan efek
    // (aturan react-hooks/set-state-in-effect), sama seperti BukuTamuRombongan.
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function moderate(id: string, action: "APPROVE" | "REJECT", alasan?: string) {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, reason: alasan }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Gagal memoderasi memori");
      toast("success", action === "APPROVE" ? "Memori disetujui" : "Memori ditolak");
      setRejectingId(null);
      setReason("");
      await load();
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/memories?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Gagal menghapus memori");
      toast("success", "Memori dihapus");
      await load();
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setBusyId(null);
      setDeletingId(null);
    }
  }

  if (rows === null) {
    return (
      <div className="rounded-lg border border-dashed border-wood/25 bg-cream px-4 py-12 text-center text-sm text-muted">
        Memuat daftar memori...
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-wood/25 bg-cream px-4 py-12 text-center">
        <p className="font-display text-lg text-forest">Tidak ada memori untuk dimoderasi</p>
        <p className="mt-1 text-sm text-muted">
          Kiriman anggota yang menunggu moderasi akan muncul di sini.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-sm border border-wood/30 px-4 text-sm font-semibold text-forest transition-colors hover:bg-wood/10"
        >
          <FiRefreshCw aria-hidden="true" className="size-4" />
          Muat ulang
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-wood/15 bg-cream">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-wood/15 text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3 font-medium">Judul</th>
            <th className="px-4 py-3 font-medium">Jenis</th>
            <th className="px-4 py-3 font-medium">Pengirim</th>
            <th className="px-4 py-3 font-medium">Orang</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const Icon = KIND_ICON[row.kind] ?? FiFileText;
            const busy = busyId === row.id;
            return (
              <tr key={row.id} className="border-b border-wood/10 last:border-b-0">
                <td className="px-4 py-3 align-top">
                  <p className="font-medium text-forest">{row.title}</p>
                  <p className="mt-0.5 text-xs text-muted tabular-nums">
                    {new Date(row.createdAt).toLocaleDateString("id-ID")}
                  </p>
                  {row.status === "REJECTED" && row.rejectionReason && (
                    <p className="mt-1 text-xs text-wood">Alasan: {row.rejectionReason}</p>
                  )}
                </td>
                <td className="px-4 py-3 align-top">
                  <span className="inline-flex items-center gap-1.5 text-ink">
                    <Icon aria-hidden="true" className="size-4 text-wood" />
                    {KIND_LABEL[row.kind] ?? row.kind}
                  </span>
                </td>
                <td className="px-4 py-3 align-top text-ink">
                  {row.uploader?.username ?? "?"}
                </td>
                <td className="px-4 py-3 align-top text-ink">
                  {row.person?.fullName ?? "?"}
                </td>
                <td className="px-4 py-3 align-top">
                  <span
                    className={`inline-flex min-h-6 items-center rounded-sm px-2 py-0.5 text-xs font-medium ${
                      STATUS_STYLE[row.status] ?? "bg-forest/10 text-forest"
                    }`}
                  >
                    {STATUS_LABEL[row.status] ?? row.status}
                  </span>
                </td>
                <td className="px-4 py-3 align-top">
                  {rejectingId === row.id ? (
                    <div className="min-w-56 space-y-2">
                      <label htmlFor={`reason-${row.id}`} className="block text-xs font-medium text-muted">
                        Alasan penolakan
                      </label>
                      <textarea
                        id={`reason-${row.id}`}
                        rows={2}
                        maxLength={500}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="block w-full rounded-sm border border-wood/30 bg-cream px-3 py-2 text-base text-ink placeholder:text-muted/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                        placeholder="Misal: Bukan kenangan keluarga"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={!reason.trim() || busy}
                          onClick={() => void moderate(row.id, "REJECT", reason.trim())}
                          className="min-h-11 rounded-sm bg-wood px-3 py-2 text-xs font-semibold text-cream transition-colors hover:bg-wood-soft disabled:opacity-50"
                        >
                          Tolak
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectingId(null);
                            setReason("");
                          }}
                          className="min-h-11 rounded-sm border border-wood/30 px-3 py-2 text-xs text-muted transition-colors hover:bg-wood/10"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {row.status !== "APPROVED" && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void moderate(row.id, "APPROVE")}
                          className="min-h-11 rounded-sm bg-forest px-3 py-2 text-xs font-semibold text-cream transition-colors hover:bg-forest-soft disabled:opacity-50"
                        >
                          Setujui
                        </button>
                      )}
                      {row.status !== "REJECTED" && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setRejectingId(row.id);
                            setReason("");
                          }}
                          className="min-h-11 rounded-sm border border-wood/30 px-3 py-2 text-xs font-semibold text-wood transition-colors hover:bg-wood/10 disabled:opacity-50"
                        >
                          Tolak
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setDeletingId(row.id)}
                        className="min-h-11 rounded-sm border border-wood/20 px-3 py-2 text-xs text-muted transition-colors hover:bg-wood/10 disabled:opacity-50"
                      >
                        Hapus
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <ConfirmDialog
        open={deletingId !== null}
        onClose={() => setDeletingId(null)}
        onConfirm={() => deletingId && remove(deletingId)}
        title="Hapus memori"
        message="Memori dan berkasnya akan dihapus permanen."
      />
    </div>
  );
}

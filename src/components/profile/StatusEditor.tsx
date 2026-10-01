"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buttonClass, controlClass } from "./editor-shared";
import { formatDateTime } from "@/lib/utils";

export type StatusItem = { id: string; message: string; createdAt: string };

/**
 * Editor status bubble anggota. Menulis ke `/api/profil/status` lalu
 * menyegarkan data server sehingga bubble terbaru langsung tampil.
 */
export function StatusEditor({ personId, initialStatuses }: { personId: string; initialStatuses: StatusItem[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const latest = initialStatuses[0];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice("");
    try {
      const response = await fetch("/api/profil/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Status belum tersimpan. Coba lagi.");
      }
      setMessage("");
      setNotice("Status berhasil diperbarui.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Status belum tersimpan. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-wood/15 bg-cream p-5">
      <h2 className="font-display text-lg font-semibold text-forest">Status</h2>
      <p className="mt-1 text-sm text-muted">
        Kabar singkat ini tampil sebagai bubble di profil publik Anda. Riwayat hanya terlihat oleh anggota yang login.
      </p>

      {latest ? (
        <div className="mt-4 rounded-2xl border border-gold/30 bg-gold/10 px-4 py-3">
          <p className="whitespace-pre-wrap text-forest">{latest.message}</p>
          <p className="mt-1 text-xs text-muted">{formatDateTime(latest.createdAt)}</p>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">Belum ada status. Tulis kabar terbaru Anda.</p>
      )}

      <form className="mt-4 space-y-3" onSubmit={submit}>
        <label className="block min-w-0 text-sm">
          Status
          <textarea
            className={controlClass}
            rows={3}
            maxLength={500}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Tulis kabar terbaru keluarga"
          />
        </label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="text-sm text-forest">{notice}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={saving || !message.trim()} className={`${buttonClass} bg-gold !text-ink`}>
            {saving ? "Menyimpan..." : "Perbarui status"}
          </button>
          <Link href={`/profil/${personId}`} className="text-sm text-forest underline underline-offset-4">
            Lihat riwayat di profil
          </Link>
        </div>
      </form>
    </section>
  );
}

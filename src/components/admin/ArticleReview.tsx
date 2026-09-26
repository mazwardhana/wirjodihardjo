"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toast";

/**
 * Form review artikel (approve/reject dengan catatan) untuk admin.
 */
export function ArticleReview({ articleId }: { articleId: string }) {
  const router = useRouter();
  const [reviewNote, setReviewNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(action: "approve" | "reject") {
    if (action === "reject" && !reviewNote.trim()) {
      setError("Cantumkan alasan penolakan agar penulis tahu apa yang perlu diperbaiki.");
      return;
    }
    setError(null);
    setBusy(true);

    try {
      const res = await fetch("/api/admin/artikel/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: articleId,
          action,
          reviewNote: reviewNote.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Gagal memproses review");

      toast("success", action === "approve" ? "Artikel disetujui." : "Artikel ditolak.");
      router.refresh();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Gagal memproses review");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-gold/30 bg-gold/5 p-5">
      <h2 className="font-display text-lg font-semibold text-forest">
        Review Artikel
      </h2>
      <p className="mt-1 text-sm text-muted">
        Artikel berstatus PENDING. Setujui untuk menampilkan di Hall of Fame,
        atau tolak dengan catatan perbaikan.
      </p>

      <div className="mt-4">
        <label htmlFor="reviewNote" className="block text-sm font-medium text-forest">
          Catatan Review (wajib jika menolak)
        </label>
        <textarea
          id="reviewNote"
          rows={3}
          value={reviewNote}
          onChange={(e) => setReviewNote(e.target.value)}
          className="mt-1 block w-full rounded-md border border-wood/30 bg-cream px-4 py-2.5 text-sm text-forest placeholder:text-muted/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
          placeholder="Contoh: Mohon tambahkan sumber referensi untuk data yang disebutkan."
        />
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-md bg-wood/10 p-3 text-sm text-wood">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => submit("approve")}
          disabled={busy}
          className="rounded-md bg-forest px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft disabled:opacity-50"
        >
          {busy ? "Memproses..." : "Setujui Artikel"}
        </button>
        <button
          type="button"
          onClick={() => submit("reject")}
          disabled={busy}
          className="rounded-md bg-wood px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-wood-soft disabled:opacity-50"
        >
          {busy ? "Memproses..." : "Tolak Artikel"}
        </button>
      </div>
    </div>
  );
}
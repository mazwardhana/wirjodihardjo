"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Submission = {
  id: string;
  type: string;
  status: string;
  payload: unknown;
  reviewNote?: string | null;
  createdAt: string;
  submitter: { person: { fullName: string } };
  targetPerson: { id: string; fullName: string; branch: { name: string } | null } | null;
  reviewer: { person: { fullName: string } } | null;
  reviewedAt?: string | null;
};

const typeLabels: Record<string, string> = {
  ADD_CHILD: "Tambah Anak",
  ADD_SPOUSE: "Tambah Pasangan",
  ADD_PERSON: "Tambah Anggota",
  EDIT_PERSON: "Edit Anggota",
  EDIT_RELATION: "Edit Relasi",
};

export function AdminPengajuanList({ submissions }: { submissions: Submission[] }) {
  return (
    <div className="mt-6 space-y-4">
      {submissions.map((s) => (
        <SubmissionCard key={s.id} submission={s} />
      ))}
    </div>
  );
}

function SubmissionCard({ submission }: { submission: Submission }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  async function review(action: "APPROVE" | "REJECT") {
    setError(null);
    setStatusMsg(null);
    if (action === "REJECT" && !reviewNote.trim()) {
      setError("Berikan alasan penolakan.");
      return;
    }
    setBusy(action);
    try {
      const res = await fetch("/api/pengajuan/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: submission.id,
          action,
          reviewNote: reviewNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Gagal");
      setStatusMsg(action === "APPROVE" ? "Pengajuan disetujui." : "Pengajuan ditolak.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memproses pengajuan");
    } finally {
      setBusy(null);
    }
  }

  const statusColors: Record<string, string> = {
    PENDING: "bg-gold/20 text-gold-deep",
    APPROVED: "bg-forest/10 text-forest",
    REJECTED: "bg-wood/10 text-wood",
  };

  return (
    <div className="rounded-lg border border-wood/15 bg-cream p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-forest">
            {typeLabels[submission.type] ?? submission.type.replace(/_/g, " ")}
          </p>
          <p className="text-sm text-muted">
            Diajukan oleh: {submission.submitter.person.fullName}
          </p>
          {submission.targetPerson && (
            <p className="text-sm text-muted">
              Terkait: {submission.targetPerson.fullName}
              {submission.targetPerson.branch && ` (${submission.targetPerson.branch.name})`}
            </p>
          )}
          <p className="text-xs text-muted">
            {new Date(submission.createdAt).toLocaleDateString("id-ID", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusColors[submission.status] ?? ""}`}>
            {submission.status === "PENDING" ? "Tertunda" : submission.status === "APPROVED" ? "Disetujui" : "Ditolak"}
          </span>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="min-h-11 text-xs text-muted underline hover:text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            {expanded ? "Tutup" : "Lihat data"}
          </button>
        </div>
      </div>

      {submission.reviewer && (
        <p className="mt-2 text-xs text-muted">
          Diproses oleh: {submission.reviewer.person.fullName}
          {submission.reviewedAt && ` · ${new Date(submission.reviewedAt).toLocaleDateString("id-ID")}`}
        </p>
      )}

      {submission.reviewNote && (
        <p className="mt-2 rounded bg-wood/10 p-2 text-sm text-wood">
          {submission.reviewNote}
        </p>
      )}

      {expanded && (
        <div className="mt-4">
          <pre className="overflow-x-auto rounded-md border border-wood/15 bg-parchment/50 p-3 text-xs text-muted">
            {JSON.stringify(submission.payload, null, 2)}
          </pre>

          {submission.status === "PENDING" && (
            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor={`note-${submission.id}`} className="block text-xs font-medium text-muted">
                  Catatan (wajib untuk penolakan)
                </label>
                <textarea
                  id={`note-${submission.id}`}
                  rows={2}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-wood/25 bg-cream px-3 py-2 text-sm text-forest placeholder:text-muted/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
                  placeholder="Alasan penolakan atau catatan persetujuan..."
                />
              </div>

              {error && (
                <p role="alert" className="rounded-md bg-wood/10 px-3 py-2 text-sm text-wood">
                  {error}
                </p>
              )}
              {statusMsg && (
                <p role="status" className="rounded-md bg-forest/10 px-3 py-2 text-sm text-forest">
                  {statusMsg}
                </p>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => review("APPROVE")}
                  disabled={busy !== null}
                  className="min-h-11 rounded-md bg-forest px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                >
                  {busy === "APPROVE" ? "Menyetujui..." : "Setujui"}
                </button>
                <button
                  type="button"
                  onClick={() => review("REJECT")}
                  disabled={busy !== null}
                  className="min-h-11 rounded-md border border-wood/30 px-4 py-2 text-sm font-medium text-wood transition-colors hover:bg-wood/10 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                >
                  {busy === "REJECT" ? "Menolak..." : "Tolak"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
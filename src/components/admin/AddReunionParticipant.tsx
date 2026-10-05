"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { toast } from "@/components/ui/Toast";

export type ParticipantCandidate = {
  id: string;
  fullName: string;
  namaPanggilan: string | null;
  branch: { name: string } | null;
};

/**
 * Tambah peserta reuni secara manual.
 *
 * Dipakai panitia untuk mendaftarkan anggota yang tidak bisa mendaftar sendiri,
 * misalnya anggota lama yang belum punya akun. Kandidat diambil dari server,
 * jadi yang diproses di sini hanya pencarian dan pengiriman POST.
 */
export function AddReunionParticipant({
  reunionId,
  candidates,
}: {
  reunionId: string;
  candidates: ParticipantCandidate[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        (c.namaPanggilan ?? "").toLowerCase().includes(q) ||
        (c.branch?.name ?? "").toLowerCase().includes(q),
    );
  }, [candidates, query]);

  const handleAdd = async (personId: string) => {
    setBusy(personId);
    try {
      const res = await fetch("/api/admin/reuni/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reunionId, personId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal menambah peserta");
      toast("success", "Peserta ditambahkan");
      setOpen(false);
      setQuery("");
      router.refresh();
    } catch (err) {
      toast("error", (err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 rounded-md border border-wood/30 px-4 py-2 text-sm font-semibold text-forest transition-colors hover:bg-wood/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
      >
        Tambah Peserta
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Tambah Peserta Reuni"
        description="Daftarkan anggota yang belum bisa mendaftar sendiri, misalnya anggota lama yang belum punya akun."
        size="lg"
      >
        <label htmlFor="cari-peserta" className="text-sm font-medium text-forest">
          Cari anggota
        </label>
        <input
          id="cari-peserta"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nama atau keluarga cabang"
          className="mt-1 min-h-11 w-full rounded-md border border-wood/30 bg-cream px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        />

        {filtered.length === 0 ? (
          <p className="mt-6 rounded-md border border-dashed border-wood/30 bg-parchment/40 px-5 py-6 text-center text-sm text-muted">
            {candidates.length === 0
              ? "Semua anggota sudah terdaftar di reuni ini."
              : "Tidak ada anggota yang cocok dengan pencarian ini."}
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-wood/10 border-y border-wood/15">
            {filtered.map((candidate) => (
              <li
                key={candidate.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium text-forest">
                    {candidate.fullName}
                  </p>
                  <p className="text-xs text-muted">
                    {candidate.namaPanggilan || candidate.fullName}
                    {" · "}
                    {candidate.branch?.name ?? "Belum ditugaskan"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy === candidate.id}
                  onClick={() => handleAdd(candidate.id)}
                  className="min-h-11 shrink-0 rounded-md bg-forest px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                >
                  {busy === candidate.id ? "..." : "Tambahkan"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Dialog>
    </>
  );
}
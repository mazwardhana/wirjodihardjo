"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toast";

export type MyRegistration = { status: string; guestCount: number } | null;

/**
 * Tombol pendaftaran reuni untuk pengunjung yang login.
 * Tiga jalur nyata: daftar (form jumlah tamu + catatan), ubah data diri
 * yang sudah terdaftar, dan batalkan pendaftaran.
 */
export function RegistrationButton({
  reunionId,
  isOpen,
  isFull,
  deadlinePassed,
  registration,
  isLoggedIn,
}: {
  reunionId: string;
  isOpen: boolean;
  isFull: boolean;
  deadlinePassed: boolean;
  registration: MyRegistration;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [guestCount, setGuestCount] = useState(registration?.guestCount ?? 1);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  const active = registration !== null && registration.status !== "CANCELLED";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/reuni/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reunionId, guestCount, notes: notes || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Pendaftaran gagal, coba lagi.");
      toast("success", data.status === "WAITLIST" ? "Anda masuk daftar tunggu." : "Pendaftaran terkirim.");
      setEditing(false);
      router.refresh();
    } catch (err) {
      toast("error", (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    try {
      const res = await fetch(`/api/reuni/register?reunionId=${encodeURIComponent(reunionId)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Pembatalan gagal, coba lagi.");
      toast("success", "Pendaftaran Anda dibatalkan.");
      router.refresh();
    } catch (err) {
      toast("error", (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!isLoggedIn) {
    return (
      <p className="rounded-lg border border-wood/20 bg-parchment/40 px-5 py-4 text-sm text-muted">
        <Link
          href={`/login?callbackUrl=${encodeURIComponent(pathname)}`}
          className="font-semibold text-forest underline decoration-gold/60 underline-offset-2 hover:text-gold-deep"
        >
          Masuk
        </Link>{" "}
        sebagai anggota keluarga untuk mendaftar reuni ini.
      </p>
    );
  }

  if (active && !editing) {
    return (
      <div className="rounded-lg border border-forest/20 bg-forest/5 px-5 py-4">
        <p className="text-sm font-semibold text-forest">
          {registration?.status === "WAITLIST" ? "Anda di daftar tunggu" : "Anda sudah terdaftar"}
          {registration ? ` untuk ${registration.guestCount} orang.` : "."}
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          {isOpen && (
            <button
              type="button"
              onClick={() => {
                setGuestCount(registration?.guestCount ?? 1);
                setEditing(true);
              }}
              className="rounded-md border border-forest/30 px-4 py-2 text-sm font-semibold text-forest transition-colors hover:bg-forest/10"
            >
              Ubah jumlah tamu
            </button>
          )}
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className="rounded-md border border-wood/30 px-4 py-2 text-sm text-muted transition-colors hover:bg-wood/10 disabled:opacity-50"
          >
            {busy ? "Memproses…" : "Batalkan pendaftaran"}
          </button>
        </div>
      </div>
    );
  }

  if (!isOpen) {
    return (
      <p className="rounded-lg border border-dashed border-wood/30 bg-parchment/40 px-5 py-4 text-sm text-muted">
        {deadlinePassed
          ? "Batas pendaftaran sudah lewat, jadi daftar peserta ditutup."
          : "Pendaftaran reuni ini belum dibuka."}
      </p>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-lg border border-wood/20 bg-cream p-5"
      aria-label="Formulir pendaftaran reuni"
    >
      <h2 className="font-display text-lg font-semibold text-forest">
        {isFull ? "Masuk daftar tunggu" : "Daftar reuni ini"}
      </h2>
      {isFull && (
        <p className="mt-1 text-sm text-wood">
          Kuota penuh. Pendaftaran tetap dibuka sebagai daftar tunggu dan panitia
          akan menghubungi bila ada kursi yang kosong.
        </p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-[10rem_1fr]">
        <div>
          <label htmlFor="reg-guests" className="block text-sm font-medium text-forest">
            Jumlah orang
          </label>
          <input
            id="reg-guests"
            type="number"
            min={1}
            max={20}
            value={guestCount}
            onChange={(e) => setGuestCount(Math.max(1, Number(e.target.value) || 1))}
            className="mt-1 block w-full rounded-md border border-wood/30 bg-parchment/40 px-4 py-2.5 text-sm text-forest focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
          />
        </div>
        <div>
          <label htmlFor="reg-notes" className="block text-sm font-medium text-forest">
            Catatan untuk panitia <span className="font-normal text-muted">(opsional)</span>
          </label>
          <textarea
            id="reg-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Contohnya: rombongan dari cabang Semarang, butuh kursi anak."
            className="mt-1 block w-full rounded-md border border-wood/30 bg-parchment/40 px-4 py-2.5 text-sm text-forest placeholder:text-muted/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-gold px-5 py-2.5 text-sm font-semibold text-forest transition-colors hover:bg-gold-deep disabled:opacity-50"
        >
          {busy ? "Mengirim…" : isFull ? "Daftar waiting list" : "Kirim pendaftaran"}
        </button>
        {editing && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-md border border-wood/30 px-5 py-2.5 text-sm text-muted transition-colors hover:bg-wood/10"
          >
            Batal
          </button>
        )}
      </div>
    </form>
  );
}
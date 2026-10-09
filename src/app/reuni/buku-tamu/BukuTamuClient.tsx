"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { RegistrationBranch } from "@/lib/registrasi";
import { canSubmit, summarizeGroup, type GuestRow } from "./buku-tamu-helpers";

/* ─────────────────────────────────────────────────────────────
   Buku tamu reuni: satu QR untuk semua cabang. Wizard empat
   layar, satu kolom, target jari: pilih keluarga, cari nama,
   susun rombongan, kirim. Memakai palet buku besar keluarga
   (cream, forest, gold, wood) seperti form registrasi.
   ───────────────────────────────────────────────────────────── */

type LookupRow = {
  personId: string;
  fullName: string;
  namaPanggilan: string | null;
  branchName: string | null;
  branchNumber: number | null;
  alreadyRegistered: boolean;
  checkedIn: boolean;
};

type SubmitResult = {
  ok: boolean;
  groupId: string;
  checkedIn: string[];
  alreadyCheckedIn: string[];
  created: string[];
};

export const SEARCH_DEBOUNCE_MS = 300;
export const MIN_SEARCH_LENGTH = 2;

function IconSearch(props: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-3.6-3.6" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4.5 12.5l5 5 10-11" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function rowKey(row: GuestRow): string {
  return row.kind === "existing" ? `p:${row.personId}` : `n:${row.fullName}|${row.namaPanggilan}`;
}

function rowName(row: GuestRow): string {
  return row.kind === "existing"
    ? row.namaPanggilan || row.fullName
    : row.namaPanggilan || row.fullName;
}

function rowDetail(row: GuestRow): string {
  if (row.kind === "existing") {
    return row.branchName ? `${row.fullName} - ${row.branchName}` : row.fullName;
  }
  const gender = row.gender === "MALE" ? "Laki-laki" : row.gender === "FEMALE" ? "Perempuan" : "Lainnya";
  return `${row.fullName} - tamu baru (${gender})`;
}

export function BukuTamuClient({ branches }: { branches: RegistrationBranch[] }) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [branchId, setBranchId] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LookupRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [rows, setRows] = useState<GuestRow[]>([]);
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [walkInFullName, setWalkInFullName] = useState("");
  const [walkInPanggilan, setWalkInPanggilan] = useState("");
  const [walkInGender, setWalkInGender] = useState<"MALE" | "FEMALE" | "OTHER">("MALE");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<{ total: number; names: string[]; created: number; already: number } | null>(null);
  const firstResultRef = useRef<HTMLButtonElement>(null);

  const selectedBranch = branches.find((b) => b.id === branchId) ?? null;

  // Pencarian dengan tunda 300 ms: jangan menembak server per ketukan.
  // Kata kunci terlalu pendek tidak dianggap efek: hasilnya kosong dan
  // tidak ada pesan galat, dihitung langsung saat merender.
  const queryTooShort = query.trim().length < MIN_SEARCH_LENGTH || !branchId;
  useEffect(() => {
    if (step !== 2 || queryTooShort) return;
    const trimmed = query.trim();
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      setLookupError(null);
      try {
        const res = await fetch(
          `/api/reuni/buku-tamu/lookup?q=${encodeURIComponent(trimmed)}&branchId=${encodeURIComponent(branchId)}`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setResults([]);
          setLookupError(body.error ?? "Pencarian gagal. Coba lagi.");
          return;
        }
        const body = (await res.json()) as { rows?: LookupRow[] };
        setResults(body.rows ?? []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setResults([]);
          setLookupError("Tidak dapat menghubungi server. Periksa koneksi internet Anda.");
        }
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, branchId, step, queryTooShort]);

  // Fokus pindah ke hasil pertama setelah daftar muncul, untuk navigasi keyboard.
  useEffect(() => {
    if (step === 2 && results.length > 0) firstResultRef.current?.focus();
  }, [results, step]);

  function addExisting(row: LookupRow) {
    setRows((prev) => [
      ...prev,
      {
        kind: "existing",
        personId: row.personId,
        fullName: row.fullName,
        namaPanggilan: row.namaPanggilan,
        branchName: row.branchName,
        alreadyRegistered: row.alreadyRegistered,
        checkedIn: row.checkedIn,
      },
    ]);
    setQuery("");
    setResults([]);
    setStep(3);
  }

  function addWalkIn() {
    const name = walkInFullName.trim();
    const nick = walkInPanggilan.trim();
    if (!name || !nick) return;
    setRows((prev) => [
      ...prev,
      { kind: "walkIn", fullName: name, namaPanggilan: nick, gender: walkInGender },
    ]);
    setWalkInFullName("");
    setWalkInPanggilan("");
    setWalkInGender("MALE");
    setShowWalkIn(false);
    setStep(3);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit() {
    setSubmitting(true);
    setFormError(null);
    try {
      const payloadRows = rows.map((r) =>
        r.kind === "existing"
          ? { personId: r.personId }
          : { fullName: r.fullName, namaPanggilan: r.namaPanggilan, gender: r.gender },
      );
      const res = await fetch("/api/reuni/buku-tamu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId, rows: payloadRows }),
      });
      const body = (await res.json().catch(() => ({}))) as Partial<SubmitResult> & { error?: string };
      if (!res.ok || !body.ok) {
        setFormError(body.error ?? "Absen gagal disimpan. Silakan coba lagi.");
        return;
      }
      setDone({
        total: rows.length,
        names: rows.map(rowName),
        created: body.created?.length ?? 0,
        already: body.alreadyCheckedIn?.length ?? 0,
      });
      setRows([]);
      setStep(4);
    } catch {
      setFormError("Tidak dapat menghubungi server. Periksa koneksi internet Anda.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForNextGroup() {
    setDone(null);
    setQuery("");
    setResults([]);
    setStep(2);
  }

  if (step === 1) {
    return (
      <section aria-label="Langkah 1 dari 3: pilih keluarga besar" className="p-5 sm:p-8">
        <h2 className="font-display text-xl font-semibold text-forest">Pilih keluarga besar</h2>
        <p className="mt-1 text-sm text-muted">
          Pilih keluarga besar tempat Anda dan rombongan Anda berasal.
        </p>
        <div className="mt-5">
          <label htmlFor="buku-tamu-cabang" className="block text-sm font-semibold text-forest">
            Keluarga besar
          </label>
          <select
            id="buku-tamu-cabang"
            value={branchId}
            onChange={(event) => setBranchId(event.target.value)}
            className="mt-2 block min-h-11 w-full rounded-sm border border-wood/35 bg-cream px-3 py-2 text-sm text-ink focus:border-forest/70"
          >
            <option value="">Pilih keluarga besar</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          disabled={!branchId}
          onClick={() => setStep(2)}
          className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-sm bg-forest px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          Lanjut cari nama
        </button>
      </section>
    );
  }

  if (step === 2) {
    return (
      <section aria-label="Langkah 2 dari 3: cari nama" className="p-5 sm:p-8">
        <button
          type="button"
          onClick={() => setStep(1)}
          className="inline-flex min-h-11 items-center text-sm text-muted transition-colors hover:text-forest"
        >
          &larr; Ganti keluarga besar
        </button>
        <h2 className="mt-3 font-display text-xl font-semibold text-forest">
          Cari nama {selectedBranch ? `di ${selectedBranch.name}` : ""}
        </h2>
        <p className="mt-1 text-sm text-muted">
          Ketik nama panggilan atau nama lengkap. Nama yang sudah absen tidak bisa dipilih lagi.
        </p>
        <div className="relative mt-4">
          <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            <IconSearch />
          </span>
          <label htmlFor="buku-tamu-cari" className="sr-only">
            Cari nama anggota
          </label>
          <input
            id="buku-tamu-cari"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ketik minimal 2 huruf"
            autoComplete="off"
            className="block min-h-11 w-full rounded-sm border border-wood/35 bg-cream py-2 pl-10 pr-3 text-sm text-ink placeholder:text-muted/80 focus:border-forest/70"
          />
        </div>

        {searching && <p className="mt-3 text-sm text-muted" role="status">Mencari&hellip;</p>}
        {lookupError && (
          <p className="mt-3 text-sm font-medium text-wood" role="alert">{lookupError}</p>
        )}

        <ul className="mt-3 space-y-2" aria-label="Hasil pencarian">
          {results.map((row, index) => (
            <li key={row.personId}>
              <button
                type="button"
                ref={index === 0 ? firstResultRef : undefined}
                onClick={() => addExisting(row)}
                disabled={row.checkedIn}
                aria-disabled={row.checkedIn || undefined}
                className={cn(
                  "flex min-h-11 w-full flex-col gap-0.5 rounded-sm border px-4 py-2.5 text-left transition-colors",
                  row.checkedIn
                    ? "cursor-not-allowed border-wood/15 bg-parchment/30 opacity-60"
                    : "border-wood/25 bg-parchment/40 hover:border-forest/50",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-forest">{row.namaPanggilan || row.fullName}</span>
                  {row.checkedIn && (
                    <span className="shrink-0 rounded-full bg-wood/10 px-2.5 py-0.5 text-xs font-medium text-wood">
                      Sudah absen
                    </span>
                  )}
                  {!row.checkedIn && row.alreadyRegistered && (
                    <span className="shrink-0 rounded-full bg-forest/10 px-2.5 py-0.5 text-xs font-medium text-forest">
                      Terdaftar
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted">
                  {row.fullName}
                  {row.branchName ? ` - ${row.branchName}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {query.trim().length >= MIN_SEARCH_LENGTH && !searching && results.length === 0 && !lookupError && (
          <div className="mt-3 rounded-sm border border-dashed border-wood/30 bg-parchment/30 px-4 py-4 text-center">
            <p className="text-sm text-muted">
              Nama tidak ditemukan di {selectedBranch?.name ?? "cabang ini"}.
            </p>
            <button
              type="button"
              onClick={() => setShowWalkIn(true)}
              className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-forest underline decoration-gold-deep decoration-2 underline-offset-4"
            >
              <IconPlus />
              Tambah sebagai tamu baru
            </button>
          </div>
        )}

        {showWalkIn && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              addWalkIn();
            }}
            className="mt-4 rounded-sm border border-wood/25 bg-parchment/40 p-4"
            aria-label="Formulir tamu baru"
          >
            <p className="text-sm font-semibold text-forest">Tamu baru</p>
            <p className="mt-0.5 text-xs text-muted">
              Akun dibuatkan setelah pengurus menyetujui. Tanpa nomor telepon atau alamat.
            </p>
            <div className="mt-3 space-y-3">
              <div>
                <label htmlFor="walkin-lengkap" className="block text-sm font-semibold text-forest">
                  Nama lengkap
                </label>
                <input
                  id="walkin-lengkap"
                  type="text"
                  value={walkInFullName}
                  onChange={(event) => setWalkInFullName(event.target.value)}
                  required
                  maxLength={200}
                  className="mt-1 block min-h-11 w-full rounded-sm border border-wood/35 bg-cream px-3 py-2 text-sm text-ink focus:border-forest/70"
                />
              </div>
              <div>
                <label htmlFor="walkin-panggilan" className="block text-sm font-semibold text-forest">
                  Nama panggilan
                </label>
                <input
                  id="walkin-panggilan"
                  type="text"
                  value={walkInPanggilan}
                  onChange={(event) => setWalkInPanggilan(event.target.value)}
                  required
                  maxLength={100}
                  className="mt-1 block min-h-11 w-full rounded-sm border border-wood/35 bg-cream px-3 py-2 text-sm text-ink focus:border-forest/70"
                />
              </div>
              <div>
                <label htmlFor="walkin-gender" className="block text-sm font-semibold text-forest">
                  Jenis kelamin
                </label>
                <select
                  id="walkin-gender"
                  value={walkInGender}
                  onChange={(event) => setWalkInGender(event.target.value as "MALE" | "FEMALE" | "OTHER")}
                  className="mt-1 block min-h-11 w-full rounded-sm border border-wood/35 bg-cream px-3 py-2 text-sm text-ink focus:border-forest/70"
                >
                  <option value="MALE">Laki-laki</option>
                  <option value="FEMALE">Perempuan</option>
                  <option value="OTHER">Lainnya</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-sm bg-forest px-4 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft"
              >
                Tambahkan
              </button>
              <button
                type="button"
                onClick={() => setShowWalkIn(false)}
                className="inline-flex min-h-11 items-center justify-center rounded-sm border border-wood/35 px-4 py-2.5 text-sm font-semibold text-wood transition-colors hover:bg-wood/10"
              >
                Batal
              </button>
            </div>
          </form>
        )}

        {rows.length > 0 && (
          <button
            type="button"
            onClick={() => setStep(3)}
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-sm bg-forest px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft"
          >
            Lanjut tinjau rombongan ({rows.length} orang)
          </button>
        )}
      </section>
    );
  }

  if (step === 3) {
    const summary = summarizeGroup(rows);
    return (
      <section aria-label="Langkah 3 dari 3: tinjau rombongan" className="p-5 sm:p-8">
        <button
          type="button"
          onClick={() => setStep(2)}
          className="inline-flex min-h-11 items-center text-sm text-muted transition-colors hover:text-forest"
        >
          &larr; Cari nama lain
        </button>
        <h2 className="mt-3 font-display text-xl font-semibold text-forest">Tinjau rombongan</h2>
        <p className="mt-1 text-sm text-muted">
          {summary.total} orang: {summary.existing} terdaftar, {summary.walkIn} tamu baru.
        </p>
        <ul className="mt-4 space-y-2" aria-label="Daftar rombongan">
          {rows.map((row, index) => (
            <li
              key={rowKey(row)}
              className="flex items-start justify-between gap-3 rounded-sm border border-wood/25 bg-parchment/40 px-4 py-2.5"
            >
              <div className="min-w-0">
                <p className="font-semibold text-forest">{rowName(row)}</p>
                <p className="text-xs text-muted">{rowDetail(row)}</p>
              </div>
              <button
                type="button"
                onClick={() => removeRow(index)}
                aria-label={`Hapus ${rowName(row)} dari daftar`}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-sm text-muted transition-colors hover:bg-wood/10 hover:text-wood"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => {
            setStep(2);
            setShowWalkIn(false);
          }}
          className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-forest underline decoration-gold-deep decoration-2 underline-offset-4"
        >
          <IconPlus />
          Tambah orang lagi
        </button>
        {formError && (
          <p className="mt-4 text-sm font-medium text-wood" role="alert">{formError}</p>
        )}
        <button
          type="button"
          disabled={!canSubmit(rows) || submitting}
          onClick={submit}
          aria-disabled={!canSubmit(rows) || undefined}
          className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-sm bg-forest px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Menyimpan\u2026" : "Tandai hadir"}
        </button>
        {!canSubmit(rows) && rows.length > 0 && (
          <p className="mt-2 text-xs text-muted">
            Periksa daftar: ada nama ganda, tamu baru belum lengkap, atau orang yang sudah absen.
          </p>
        )}
      </section>
    );
  }

  return (
    <section aria-label="Buku tamu tercatat" className="p-5 text-center sm:p-8">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-forest/10 text-forest">
        <IconCheck />
      </span>
      <h2 className="mt-4 font-display text-2xl font-semibold text-forest">Kehadiran tercatat</h2>
      <p className="mt-2 text-sm text-muted">
        {done?.total} orang dari rombongan Anda sudah ditandai hadir.
        {done && done.created > 0 && ` ${done.created} tamu baru menunggu persetujuan pengurus untuk dibuatkan akun.`}
        {done && done.already > 0 && ` ${done.already} nama ternyata sudah absen sebelumnya.`}
      </p>
      {done && (
        <ul className="mt-4 space-y-1 text-sm text-ink" aria-label="Nama yang tercatat">
          {done.names.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={resetForNextGroup}
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-sm bg-forest px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft"
      >
        Tambah rombongan lain
      </button>
    </section>
  );
}

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { MAX_IMPORT_BYTES } from "@/lib/import/types";
import type {
  RegistrasiCounts,
  RegistrasiCredential,
  RegistrasiSkipRow,
  RegistrasiValidationError,
} from "@/lib/registrasi-import/types";

export type RegistrasiBatchSummary = {
  id: string;
  filename: string;
  status: string;
  totalRows: number;
  successRows: number;
  errorRows: number;
  createdAt: string;
  createdBy: string;
};

type PreviewRow = {
  _row?: number;
  cabangKe: string;
  namaPanggilan: string;
  namaLengkap: string;
  gender: string;
  status: string;
  hadir: string;
  username: string;
  /** null bila baris tidak punya rencana kredensial (mis. ber-error). */
  willAttend: boolean | null;
  branchNumber: number | null;
  accountStatus: string;
};

type UploadResult = {
  batchId: string;
  filename: string;
  valid: boolean;
  totalRows: number;
  errors: RegistrasiValidationError[];
  warnings: string[];
  counts: RegistrasiCounts;
  credentials: RegistrasiCredential[];
  skipped: RegistrasiSkipRow[];
  preview: { rows: PreviewRow[] };
};

type CommitResult = {
  success: boolean;
  batchId: string;
  counts: RegistrasiCounts;
  credentials: RegistrasiCredential[];
  skipped: RegistrasiSkipRow[];
};

const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest";
const buttonStyle = `min-h-11 rounded-md border border-wood px-4 py-2 text-sm font-semibold ${focus}`;

function statusLabel(status: string): string {
  if (status === "COMMITTED") return "Tersimpan";
  if (status === "PARTIAL") return "Tersimpan sebagian";
  if (status === "FAILED") return "Gagal";
  if (status === "VALIDATED") return "Belum disimpan";
  return status;
}

function isCommittedStatus(status: string): boolean {
  return status === "COMMITTED" || status === "PARTIAL";
}

function credentialsUrl(batchId: string): string {
  return `/api/admin/registrasi/laporan?id=${encodeURIComponent(batchId)}&format=credentials`;
}

export function RegistrasiImporClient({ recentBatches }: { recentBatches: RegistrasiBatchSummary[] }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [filename, setFilename] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [committed, setCommitted] = useState<CommitResult | null>(null);
  const [page, setPage] = useState(0);

  const busy = uploading || committing;
  const rows = result?.preview.rows ?? [];
  const pageSize = 20;

  async function upload(files: FileList | null) {
    if (inFlight.current || !files?.length) return;
    setError(null);
    if (files.length !== 1) {
      setError("Pilih satu file untuk setiap impor.");
      return;
    }
    const file = files[0];
    if (!/\.(xlsx|xlsm|csv)$/i.test(file.name)) {
      setError("Format file harus .xlsx, .xlsm, atau .csv. Gunakan template di atas.");
      return;
    }
    if (file.size === 0 || file.size > MAX_IMPORT_BYTES) {
      setError(file.size === 0 ? "File kosong. Pilih file yang sudah diisi." : "Ukuran file melebihi 10MB. Kurangi isinya lalu unggah ulang.");
      return;
    }
    inFlight.current = true;
    setFilename(file.name);
    setUploading(true);
    setResult(null);
    setCommitted(null);
    setPage(0);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/admin/registrasi", { method: "POST", body: formData });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
            ? data.error
            : "Unggahan gagal. Periksa koneksi lalu coba lagi.",
        );
      }
      if (
        typeof data !== "object" ||
        data === null ||
        !("batchId" in data) ||
        typeof data.batchId !== "string" ||
        !data.batchId ||
        !("valid" in data) ||
        typeof data.valid !== "boolean"
      ) {
        throw new Error("Respons unggahan tidak lengkap. Muat ulang halaman lalu coba lagi.");
      }
      setResult(data as UploadResult);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unggahan gagal. Periksa koneksi lalu coba lagi.");
    } finally {
      inFlight.current = false;
      setUploading(false);
    }
  }

  async function commit() {
    if (inFlight.current || !result || !result.valid) return;
    inFlight.current = true;
    setCommitting(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/registrasi/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: result.batchId }),
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
            ? data.error
            : "Penyimpanan belum dapat dikonfirmasi.",
        );
      }
      setCommitted(data as CommitResult);
      router.refresh();
    } catch (cause) {
      setError(
        `${cause instanceof Error ? cause.message : "Penyimpanan belum dapat dikonfirmasi."} Periksa laporan sebelum mencoba lagi agar tidak mengulang penyimpanan.`,
      );
    } finally {
      inFlight.current = false;
      setCommitting(false);
    }
  }

  return (
    <div className="min-w-0 space-y-8 text-forest [overflow-wrap:anywhere]">
      <section className="rounded-lg border border-wood/20 bg-cream p-4 sm:p-6" aria-labelledby="upload-title">
        <h2 id="upload-title" className="text-lg font-semibold">Unggah file registrasi</h2>
        <p className="mt-1 text-sm text-muted">
          Isi template lalu unggah file XLSX, XLSM, atau CSV untuk divalidasi. Data baru disimpan setelah Anda menekan Konfirmasi &amp; Simpan.
        </p>
        <div className="my-4 flex flex-wrap gap-3">
          <a href="/api/admin/registrasi/template?format=xlsx" download className={`inline-flex min-h-11 items-center rounded-md border border-wood px-4 py-2 text-sm font-semibold hover:bg-parchment ${focus}`}>
            Unduh template XLSX
          </a>
          <a href="/api/admin/registrasi/template?format=csv" download className={`inline-flex min-h-11 items-center rounded-md border border-wood px-4 py-2 text-sm font-semibold hover:bg-parchment ${focus}`}>
            Unduh template CSV
          </a>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".xlsx,.xlsm,.csv"
          disabled={busy}
          className="hidden"
          aria-label="Pilih file impor registrasi"
          onChange={(event) => {
            void upload(event.currentTarget.files);
            event.currentTarget.value = "";
          }}
        />
        <button
          type="button"
          disabled={busy}
          aria-describedby="upload-hint"
          aria-busy={uploading}
          onClick={() => fileInput.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = busy ? "none" : "copy";
            if (!busy) setDragging(true);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void upload(event.dataTransfer.files);
          }}
          className={`flex min-h-40 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-wood px-4 py-6 text-center disabled:cursor-wait ${focus} ${dragging ? "bg-parchment" : "bg-cream hover:bg-parchment/50"}`}
        >
          <span className="font-semibold">{uploading ? "Mengunggah dan memvalidasi file..." : dragging ? "Lepaskan file untuk mengunggah" : "Pilih atau seret file ke sini"}</span>
          <span id="upload-hint" className="text-sm text-muted">XLSX, XLSM, atau CSV, maksimal 10MB. Data belum disimpan sebelum Anda menyetujui pratinjau.</span>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
          className={`${buttonStyle} mt-4 bg-forest text-cream hover:bg-forest-soft disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {uploading ? "Mengunggah..." : "Unggah & Validasi"}
        </button>
        <div role="status" aria-live="polite" className="text-sm text-muted">
          {uploading && <p className="mt-4">Memproses {filename}. Tunggu hingga hasil validasi tampil di bawah.</p>}
        </div>
        <div aria-live="assertive" aria-atomic="true">
          {error && <p className="mt-4 rounded-md border border-wood bg-parchment p-3 text-sm text-wood">{error}</p>}
        </div>
      </section>

      {committed && (
        <section className="rounded-lg border border-forest/30 bg-cream p-4 sm:p-6" aria-labelledby="commit-title" aria-live="polite">
          <h2 id="commit-title" className="text-lg font-semibold">Data registrasi tersimpan</h2>
          <p className="mt-1 text-sm text-muted">
            Batch {committed.batchId} sudah disimpan. Bagikan kredensial berikut kepada anggota; password default 12345678 wajib diganti saat login pertama.
          </p>
          <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {([
              ["Total baris", committed.counts.total],
              ["Anggota baru", committed.counts.personsCreated],
              ["Akun baru", committed.counts.accountsCreated],
              ["Peserta reuni direncanakan", committed.counts.attendeesPlanned],
              ["Baris dilewati", committed.counts.rowsSkipped],
            ] as const).map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3 border-b border-wood/10 pb-2">
                <dt className="text-muted">{label}</dt>
                <dd className="font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          <a href={credentialsUrl(committed.batchId)} download className={`mt-4 inline-flex min-h-11 items-center rounded-md border border-wood px-4 py-2 text-sm font-semibold hover:bg-parchment ${focus}`}>
            Unduh laporan kredensial
          </a>
        </section>
      )}

      {result && !committed && (
        <section className="min-w-0 space-y-6" aria-labelledby="result-title" aria-live="polite">
          <div className="rounded-lg border border-wood/20 bg-cream p-4">
            <h2 id="result-title" className="text-lg font-semibold">Hasil validasi: {result.filename}</h2>
            <p className="mt-1 text-sm text-muted">
              {result.valid
                ? "File lolos validasi. Periksa rencana di bawah lalu konfirmasi untuk menyimpan."
                : "File belum lolos validasi. Perbaiki file lalu unggah ulang. Belum ada data yang disimpan."}
            </p>
            <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              {([
                ["Total baris", result.counts.total],
                ["Anggota baru", result.counts.personsCreated],
                ["Akun baru", result.counts.accountsCreated],
                ["Peserta reuni direncanakan", result.counts.attendeesPlanned],
                ["Baris dilewati", result.counts.rowsSkipped],
                ["Kesalahan", result.errors.length],
              ] as const).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 border-b border-wood/10 pb-2">
                  <dt className="text-muted">{label}</dt>
                  <dd className="font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {result.errors.length > 0 && (
            <section className="rounded-lg border border-wood bg-cream p-4" aria-labelledby="errors-title">
              <h3 id="errors-title" className="font-semibold text-wood">{result.errors.length} kesalahan ditemukan</h3>
              <p className="my-2 text-sm text-muted">Perbaiki file lalu unggah ulang. Data dalam batch ini belum disimpan.</p>
              <ul className="space-y-2 text-sm">
                {result.errors.map((entry, index) => (
                  <li key={`${entry.row}-${entry.field}-${index}`} className="border-b border-wood/10 pb-2 text-wood">
                    <span className="font-semibold">Baris {entry.row}</span> · {entry.field}: {entry.message}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {result.warnings.length > 0 && (
            <section className="rounded-lg border border-gold/30 bg-cream p-4" aria-labelledby="warnings-title">
              <h3 id="warnings-title" className="font-semibold text-gold-deep">Peringatan</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-muted">
                {result.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </section>
          )}

          {result.skipped.length > 0 && (
            <section className="rounded-lg border border-wood/20 bg-cream p-4" aria-labelledby="skipped-title">
              <h3 id="skipped-title" className="font-semibold">Baris dilewati ({result.skipped.length})</h3>
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {result.skipped.map((row, index) => (
                  <li key={`${row.branchNumber}-${row.fullName}-${index}`}>
                    {row.fullName} · cabang {row.branchNumber}: {row.reason}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {rows.length > 0 && (
            <section className="min-w-0 rounded-lg border border-wood/20 bg-cream p-3 sm:p-4" aria-labelledby="preview-title">
              <h3 id="preview-title" className="mb-3 font-semibold">Pratinjau baris &amp; rencana kredensial ({rows.length} baris)</h3>
              <div className="overflow-x-auto">
                <table role="table" className="w-full text-left text-sm">
                  <caption className="sr-only">Pratinjau baris registrasi beserta rencana kredensial</caption>
                  <thead role="rowgroup" className="border-b border-wood/20">
                    <tr role="row">
                      <th scope="col" className="p-2 font-semibold">Baris</th>
                      <th scope="col" className="p-2 font-semibold">Keluarga Cabang</th>
                      <th scope="col" className="p-2 font-semibold">Nama Panggilan</th>
                      <th scope="col" className="p-2 font-semibold">Nama Lengkap</th>
                      <th scope="col" className="p-2 font-semibold">Gender</th>
                      <th scope="col" className="p-2 font-semibold">Hadir</th>
                      <th scope="col" className="p-2 font-semibold">Username</th>
                      <th scope="col" className="p-2 font-semibold">Cabang</th>
                      <th scope="col" className="p-2 font-semibold">Status akun</th>
                    </tr>
                  </thead>
                  <tbody role="rowgroup">
                    {rows.slice(page * pageSize, (page + 1) * pageSize).map((row, offset) => {
                      const index = page * pageSize + offset;
                      return (
                        <tr role="row" key={`${row._row ?? index + 2}-${index}`} className="border-t border-wood/20">
                          <td role="cell" className="p-2 text-muted">{row._row ?? index + 2}</td>
                          <td role="cell" className="p-2 text-muted">{row.cabangKe}</td>
                          <td role="cell" className="p-2 text-muted">{row.namaPanggilan || "-"}</td>
                          <td role="cell" className="p-2 text-muted">{row.namaLengkap || "-"}</td>
                          <td role="cell" className="p-2 text-muted">{row.gender || "-"}</td>
                          <td role="cell" className="p-2 text-muted">{row.willAttend === null ? (row.hadir || "-") : row.willAttend ? "Ya" : "Tidak"}</td>
                          <td role="cell" className="p-2 text-muted">{row.username || "-"}</td>
                          <td role="cell" className="p-2 text-muted">{row.branchNumber ?? "-"}</td>
                          <td role="cell" className="p-2 text-muted">{row.accountStatus || "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {rows.length > pageSize && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <p role="status" className="text-sm text-muted">
                    Baris {page * pageSize + 1} sampai {Math.min((page + 1) * pageSize, rows.length)} dari {rows.length}
                  </p>
                  <button
                    type="button"
                    disabled={page === 0}
                    onClick={() => setPage((value) => value - 1)}
                    className={`${buttonStyle} disabled:opacity-50`}
                  >
                    Sebelumnya
                  </button>
                  <button
                    type="button"
                    disabled={(page + 1) * pageSize >= rows.length}
                    onClick={() => setPage((value) => value + 1)}
                    className={`${buttonStyle} disabled:opacity-50`}
                  >
                    Berikutnya
                  </button>
                </div>
              )}
            </section>
          )}
        </section>
      )}

      {!committed && (
        <div className="sticky bottom-0 z-20 rounded-t-lg border border-wood/30 bg-cream p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <p role="status" className="mb-2 text-sm text-muted">
            {committing
              ? "Menyimpan data. Tunggu hingga ringkasan tersimpan tampil."
              : result?.valid
              ? "Data belum disimpan. Konfirmasi untuk menulis data ke database."
              : "Penyimpanan nonaktif. Unggah file yang lolos validasi terlebih dahulu."}
          </p>
          <button
            type="button"
            onClick={() => void commit()}
            disabled={!result?.valid || busy}
            aria-busy={committing}
            className={`${buttonStyle} bg-forest text-cream hover:bg-forest-soft disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {committing ? "Menyimpan..." : "Konfirmasi & Simpan"}
          </button>
        </div>
      )}

      <section aria-labelledby="history-title">
        <h2 id="history-title" className="mb-3 text-lg font-semibold">Riwayat impor registrasi</h2>
        {recentBatches.length === 0 ? (
          <p className="rounded-lg border border-dashed border-wood/30 p-4 text-sm text-muted">Belum ada impor registrasi. Unduh template, isi data, lalu unggah untuk memeriksanya.</p>
        ) : (
          <ul className="divide-y divide-wood/20 rounded-lg border border-wood/20 bg-cream">
            {recentBatches.map((batch) => (
              <li key={batch.id} className="flex min-w-0 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="font-semibold">{batch.filename}</h3>
                  <p className="mt-1 text-sm text-muted">{formatDate(batch.createdAt)} oleh {batch.createdBy}</p>
                  <p className="mt-1 text-sm">{statusLabel(batch.status)} · {batch.totalRows} baris · {batch.errorRows} kesalahan</p>
                </div>
                {isCommittedStatus(batch.status) ? (
                  <Link href={credentialsUrl(batch.id)} aria-label={`Unduh kredensial ${batch.filename}`} className={`inline-flex min-h-11 shrink-0 items-center self-start rounded-md px-3 py-2 text-sm font-semibold text-gold-deep underline hover:text-forest ${focus}`}>
                    Unduh kredensial
                  </Link>
                ) : (
                  <span className="self-start text-sm text-muted">Belum disimpan</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

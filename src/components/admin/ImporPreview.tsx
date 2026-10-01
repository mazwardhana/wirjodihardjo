"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ImportErrorTable } from "./ImporReport";
import type { ImportCounts, ImportCredential, ParsedData, ValidationError } from "@/lib/import/types";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest";
const buttonStyle = `min-h-11 rounded-md border border-wood px-4 py-2 text-sm font-semibold ${focus}`;

type Props = {
  batchId: string;
  filename: string;
  errors: ValidationError[];
  warnings: string[];
  counts: ImportCounts | null;
  credentials: ImportCredential[];
  preview: ParsedData | null;
};

export function ImporPreview({ batchId, filename, errors, warnings, counts, credentials, preview }: Props) {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const inFlight = useRef(false);
  const totalRows = preview ? preview.anggota.length : 0;
  const blocked = errors.length > 0 || !preview || !counts || totalRows === 0;
  
  const rows = (preview?.anggota ?? []).map((row, index) => ({
    number: row._row ?? index + 2,
    cells: [
      String(row.cabangKe),
      row.namaLengkap,
      row.jenisKelamin,
      row.nickname || "-",
      row.namaPanggilan || "-",
      row.tanggalLahir || "-",
      row.kotaDomisili || "-",
      row.nomorTelepon || "-",
    ],
  }));
  
  const columns = ["Keluarga Cabang", "Nama Lengkap", "Jenis Kelamin", "Nickname", "Nama Panggilan", "Tanggal Lahir", "Kota Domisili", "No. Telepon"];
  const invalidRows = new Set(errors.map((entry) => entry.row));
  const pageSize = 20;

  async function commit() {
    if (blocked || inFlight.current) return;
    inFlight.current = true;
    setCommitting(true);
    setConfirming(false);
    setError(null);
    try {
      const response = await fetch("/api/admin/impor/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId }),
      });
      if (!response.ok) {
        const data: unknown = await response.json().catch(() => null);
        throw new Error(typeof data === "object" && data !== null && "error" in data && typeof data.error === "string" ? data.error : "Penyimpanan belum dapat dikonfirmasi.");
      }
      router.push(`/admin/impor/laporan/${encodeURIComponent(batchId)}`);
    } catch (cause) {
      setError(`${cause instanceof Error ? cause.message : "Penyimpanan belum dapat dikonfirmasi."} Periksa laporan sebelum mencoba lagi agar tidak mengulang penyimpanan.`);
      inFlight.current = false;
      setCommitting(false);
    }
  }

  return (
    <div className="min-w-0 space-y-6 text-forest [overflow-wrap:anywhere]">
      <div aria-live="polite" aria-atomic="true">
        {errors.length > 0 && (
          <section className="rounded-lg border border-wood bg-cream p-4">
            <h2 className="font-semibold text-wood">{errors.length} kesalahan ditemukan</h2>
            <p className="my-2 text-sm text-muted">Perbaiki file lalu unggah ulang. Semua data dalam batch ini belum disimpan.</p>
            <ImportErrorTable errors={errors} />
          </section>
        )}
      </div>
      <div aria-live="assertive" aria-atomic="true">
        {error && (
          <div className="rounded-lg border border-wood bg-cream p-4 text-sm text-wood">
            <p>{error}</p>
            <Link href={`/admin/impor/laporan/${encodeURIComponent(batchId)}`} className={`mt-2 inline-flex min-h-11 items-center underline ${focus}`}>Periksa laporan impor</Link>
          </div>
        )}
      </div>
      {warnings.length > 0 && (
        <section className="rounded-lg border border-gold/30 bg-cream p-4">
          <h2 className="font-semibold text-gold-deep">Peringatan</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-muted">{warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
        </section>
      )}
      {counts && (
        <section className="rounded-lg border border-wood/20 bg-cream p-4">
          <h2 className="font-semibold">Rencana perubahan</h2>
          <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {([
              ["Anggota baru", counts.personsCreated],
              ["Anggota diperbarui", counts.personsUpdated],
              ["Data privat", counts.privateUpserts],
            ] as const).map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3 border-b border-wood/10 pb-2">
                <dt className="text-muted">{label}</dt>
                <dd className="font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {preview ? (
        <section className="min-w-0 rounded-lg border border-wood/20 bg-cream p-3 sm:p-4">
          <h2 className="mb-3 font-semibold">Pratinjau data anggota ({totalRows} baris)</h2>
          {rows.length === 0 ? (
            <p className="py-6 text-sm text-muted">Tidak berisi baris data. Isi sheet Data pada file sumber sebelum mengunggah ulang.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table role="table" className="w-full text-left text-sm">
                  <caption className="sr-only">Pratinjau data anggota</caption>
                  <thead role="rowgroup" className="border-b border-wood/20">
                    <tr role="row">
                      <th scope="col" className="p-2 font-semibold">Baris</th>
                      {columns.map((column) => (
                        <th key={column} scope="col" className="p-2 font-semibold">{column}</th>
                      ))}
                      <th scope="col" className="p-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody role="rowgroup">
                    {rows.slice(page * pageSize, (page + 1) * pageSize).map((row) => (
                      <tr role="row" key={row.number} className="border-t border-wood/20">
                        <td role="cell" className="p-2 text-muted">{row.number}</td>
                        {row.cells.map((cell, index) => (
                          <td role="cell" key={index} className="p-2 text-muted">{cell}</td>
                        ))}
                        <td role="cell" className="p-2 text-muted">
                          {invalidRows.has(row.number) || invalidRows.has(0) ? "Perlu diperbaiki" : "Lolos validasi"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <p role="status" className="text-sm text-muted">
                  Baris {page * pageSize + 1} sampai {Math.min((page + 1) * pageSize, rows.length)} dari {rows.length}
                </p>
                {rows.length > pageSize && (
                  <>
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
                  </>
                )}
              </div>
            </>
          )}
        </section>
      ) : (
        <p className="rounded-lg border border-wood p-4 text-sm text-muted">
          Pratinjau tidak tersedia. Data tidak dapat disimpan dari halaman ini. Kembali ke impor untuk memeriksa riwayat atau mengunggah ulang.
        </p>
      )}
      <div className="sticky bottom-0 z-20 rounded-t-lg border border-wood/30 bg-cream p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <p role="status" className="mb-2 text-sm text-muted">
          {committing
            ? "Menyimpan data. Tunggu hingga laporan terbuka."
            : blocked
            ? "Penyimpanan nonaktif. Periksa kesalahan atau data yang belum tersedia."
            : "Data belum disimpan. Periksa pratinjau sebelum melanjutkan."}
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={blocked || committing}
            aria-busy={committing}
            className={`${buttonStyle} bg-forest text-cream hover:bg-forest-soft disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {committing ? "Menyimpan..." : "Simpan ke database"}
          </button>
          {!committing && (
            <Link href="/admin/impor" className={`inline-flex items-center ${buttonStyle}`}>
              Kembali ke impor
            </Link>
          )}
        </div>
      </div>
      {confirming && <ConfirmDialog filename={filename} onCancel={() => setConfirming(false)} onConfirm={() => void commit()} />}
    </div>
  );
}

function ConfirmDialog({ filename, onCancel, onConfirm }: { filename: string; onCancel: () => void; onConfirm: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = dialog.current;
    element?.showModal();
    cancel.current?.focus();
    return () => {
      element?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="commit-title"
      aria-describedby="commit-description"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = dialog.current?.querySelectorAll<HTMLButtonElement>("button");
        if (!controls?.length) return;
        const first = controls[0],
          last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-lg border border-wood bg-cream p-5 text-forest backdrop:bg-forest/60 [overflow-wrap:anywhere]"
    >
      <h2 id="commit-title" className="font-display text-xl font-semibold">
        Simpan data anggota?
      </h2>
      <p id="commit-description" className="mt-3 text-sm text-muted">
        Data dari {filename} akan menambah atau memperbarui anggota keluarga. Tidak ada pembatalan otomatis setelah penyimpanan.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button ref={cancel} type="button" onClick={onCancel} className={buttonStyle}>
          Periksa lagi
        </button>
        <button type="button" onClick={onConfirm} className={`${buttonStyle} bg-forest text-cream hover:bg-forest-soft`}>
          Ya, simpan data
        </button>
      </div>
    </dialog>
  );
}

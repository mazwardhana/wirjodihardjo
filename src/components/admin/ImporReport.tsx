"use client";

import Link from "next/link";
import { formatDateTime } from "@/lib/utils";
import type { ImportBatchPayload, ValidationError } from "@/lib/import/types";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest";
const downloadStyle = `inline-flex min-h-11 items-center rounded-md border border-wood px-4 py-2 text-sm font-semibold text-forest hover:bg-parchment ${focus}`;

type ReportProps = {
  batchId: string;
  filename: string;
  status: string;
  totalRows: number;
  successRows: number;
  errorRows: number;
  createdAt: Date;
  createdByName: string;
  payload: ImportBatchPayload | null;
};

export function ImporReport({ batchId, filename, status, totalRows, successRows, errorRows, createdAt, createdByName, payload }: ReportProps) {
  const errors = payload?.errors ?? [];
  const credentials = payload?.credentials ?? [];
  const committed = status === "COMMITTED";
  const validated = status === "VALIDATED";
  const reportUrl = `/api/admin/impor/laporan?id=${encodeURIComponent(batchId)}`;

  return (
    <div className="min-w-0 space-y-6 text-forest [overflow-wrap:anywhere]">
      <section className="rounded-lg border border-wood/20 bg-cream p-4" aria-labelledby="report-summary">
        <h2 id="report-summary" className="text-lg font-semibold">Ringkasan impor</h2>
        <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Row label="File" value={filename} />
          <Row label="Status" value={committed ? "Tersimpan" : validated ? "Belum disimpan" : status === "FAILED" ? "Gagal" : status === "PARTIAL" ? "Tersimpan sebagian" : status} />
          <Row label="Tanggal" value={formatDateTime(createdAt)} />
          <Row label="Oleh" value={createdByName} />
          <Row label="Total baris" value={totalRows} />
          <Row label="Baris tersimpan" value={successRows} />
          <Row label="Kesalahan tercatat" value={errorRows} />
        </dl>
      </section>

      <section className="rounded-lg border border-wood/20 bg-parchment/40 p-4" aria-live="polite">
        <h2 className="font-semibold">{committed ? "Impor selesai" : validated ? "Periksa sebelum menyimpan" : status === "FAILED" ? "Impor gagal" : "Periksa hasil impor"}</h2>
        <p className="mt-2 text-sm text-muted">
          {committed ? "Data telah disimpan. Unduh kredensial jika ada akun yang perlu dibagikan." : validated
            ? errors.length ? "Masih ada kesalahan validasi. Perbaiki file lalu unggah ulang. Batch ini belum disimpan." : "Batch ini belum disimpan. Buka pratinjau untuk memeriksa data dan menyetujuinya."
            : status === "FAILED" ? "Impor tidak selesai. Periksa kesalahan yang tersedia, perbaiki file, lalu unggah ulang."
            : "Lihat ringkasan dan kesalahan sebelum melakukan impor berikutnya."}
        </p>
        {validated && payload?.data && (
          <Link href={`/admin/impor/preview?batchId=${encodeURIComponent(batchId)}`} className={`mt-3 ${downloadStyle}`}>Buka pratinjau</Link>
        )}
        {(status === "FAILED" || errors.length > 0) && (
          <Link href="/admin/impor" className={`mt-3 ${downloadStyle}`}>Unggah file perbaikan</Link>
        )}
      </section>

      {!payload ? (
        <section className="rounded-lg border border-dashed border-wood p-4">
          <h2 className="font-semibold">Detail laporan tidak tersedia</h2>
          <p className="mt-2 text-sm text-muted">Ringkasan batch masih tersedia di atas, tetapi rincian dan unduhan tidak tersedia. Periksa riwayat impor sebelum mengunggah file yang sama lagi.</p>
          <Link href="/admin/impor" className={`mt-3 ${downloadStyle}`}>Kembali ke riwayat impor</Link>
        </section>
      ) : (
        <>
          {payload.counts && (committed || validated) && (
            <section className="rounded-lg border border-wood/20 bg-cream p-4">
              <h2 className="font-semibold">{committed ? "Perubahan tersimpan" : "Rencana perubahan"}</h2>
              <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <Row label="Anggota baru" value={payload.counts.personsCreated} />
                <Row label="Anggota diperbarui" value={payload.counts.personsUpdated} />
                <Row label="Akun baru" value={payload.counts.accountsCreated} />
                <Row label="Akun diperbarui" value={payload.counts.accountsUpdated} />
                <Row label="Relasi orang tua-anak" value={payload.counts.childEdgesCreated} />
                <Row label="Relasi pasangan" value={payload.counts.partnerEdgesCreated} />
                <Row label="Data privat" value={payload.counts.privateUpserts} />
              </dl>
            </section>
          )}
          {committed && (
            <section className="rounded-lg border border-wood/20 bg-cream p-4">
              <h2 className="font-semibold">Kredensial akun</h2>
              {credentials.length > 0 ? (
                <>
                  <p id="credential-hint" className="mt-2 text-sm text-muted">Password tidak ditampilkan di halaman ini. Unduh CSV untuk mendapatkan kredensial akun baru. Bagikan hanya kredensial milik masing-masing anggota, bukan seluruh file. Anggota baru wajib mengganti password saat login pertama.</p>
                  <a href={`${reportUrl}&format=credentials`} download aria-describedby="credential-hint" className={`mt-3 ${downloadStyle}`}>Unduh kredensial CSV</a>
                </>
              ) : <p className="mt-2 text-sm text-muted">Tidak ada kredensial akun dalam batch ini.</p>}
            </section>
          )}
          {payload.warnings?.length > 0 && (
            <section className="rounded-lg border border-gold/30 bg-cream p-4">
              <h2 className="font-semibold text-gold-deep">Peringatan</h2>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-muted">{payload.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
            </section>
          )}
          <section aria-labelledby="report-errors" className="rounded-lg border border-wood/20 bg-cream p-4">
            <h2 id="report-errors" className="font-semibold">Kesalahan ({errors.length})</h2>
            {errors.length > 0 ? (
              <>
                <p className="mt-2 text-sm text-muted">Gunakan nomor baris dan kolom untuk memperbaiki file sumber.</p>
                <a href={`${reportUrl}&format=errors`} download className={`my-3 ${downloadStyle}`}>Unduh kesalahan CSV</a>
                <ImportErrorTable errors={errors} />
              </>
            ) : <p className="mt-2 text-sm text-muted">Tidak ada rincian kesalahan yang tercatat dalam laporan ini.</p>}
          </section>
        </>
      )}
    </div>
  );
}

export function ImportErrorTable({ errors }: { errors: ValidationError[] }) {
  return (
    <table role="table" className="block w-full text-left text-sm md:table md:table-fixed [overflow-wrap:anywhere]">
      <caption className="sr-only">Kesalahan per sheet, baris, dan kolom</caption>
      <thead role="rowgroup" className="sr-only md:not-sr-only md:table-header-group">
        <tr role="row"><th scope="col" className="p-2 md:w-24">Sheet</th><th scope="col" className="p-2 md:w-20">Baris</th><th scope="col" className="p-2 md:w-36">Kolom</th><th scope="col" className="p-2">Pesan</th></tr>
      </thead>
      <tbody role="rowgroup" className="block md:table-row-group">
        {errors.map((error, index) => (
          <tr role="row" key={`${error.sheet}-${error.row}-${error.field}-${index}`} className="block border-t border-wood/20 py-3 md:table-row">
            {[error.sheet, error.row === 0 ? "Sheet" : String(error.row), error.field, error.message].map((value, column) => (
              <td role="cell" key={column} className="block min-w-0 px-2 py-1 text-wood md:table-cell md:py-2">
                <span aria-hidden="true" className="mr-2 font-semibold md:hidden">{["Sheet", "Baris", "Kolom", "Pesan"][column]}:</span>{value}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return <div className="min-w-0 border-b border-wood/10 pb-2"><dt className="text-muted">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>;
}

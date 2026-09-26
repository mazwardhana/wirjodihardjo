"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { MAX_IMPORT_BYTES } from "@/lib/import/types";

type BatchSummary = {
  id: string;
  filename: string;
  status: string;
  totalRows: number;
  successRows: number;
  errorRows: number;
  createdAt: Date;
  createdBy: { person: { fullName: string } };
};

const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest";

export function ImporClient({ recentBatches }: { recentBatches: BatchSummary[] }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [filename, setFilename] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

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
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/admin/impor", { method: "POST", body: formData });
      const data: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
            ? data.error
            : "Unggahan gagal. Periksa koneksi lalu coba lagi.",
        );
      }
      if (typeof data !== "object" || data === null || !("batchId" in data) || typeof data.batchId !== "string" || !data.batchId) {
        throw new Error("Respons unggahan tidak lengkap. Muat ulang riwayat sebelum mencoba lagi.");
      }
      router.push(`/admin/impor/preview?batchId=${encodeURIComponent(data.batchId)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unggahan gagal. Periksa koneksi lalu coba lagi.");
      inFlight.current = false;
      setUploading(false);
    }
  }

  return (
    <div className="min-w-0 space-y-8 text-forest [overflow-wrap:anywhere]">
      <section className="rounded-lg border border-wood/20 bg-cream p-4 sm:p-6" aria-labelledby="upload-title">
        <h2 id="upload-title" className="text-lg font-semibold">Unggah file impor</h2>
        <a href="/api/admin/impor/template" download className={`my-4 inline-flex min-h-11 items-center rounded-md border border-wood px-4 py-2 text-sm font-semibold hover:bg-parchment ${focus}`}>
          Unduh template XLSX
        </a>
        <input
          ref={fileInput}
          type="file"
          accept=".xlsx,.xlsm,.csv"
          disabled={uploading}
          className="hidden"
          aria-label="Pilih file impor"
          onChange={(event) => {
            void upload(event.currentTarget.files);
            event.currentTarget.value = "";
          }}
        />
        <button
          type="button"
          disabled={uploading}
          aria-describedby="upload-hint"
          aria-busy={uploading}
          onClick={() => fileInput.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = uploading ? "none" : "copy";
            if (!uploading) setDragging(true);
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
        <div role="status" aria-live="polite" className="text-sm text-muted">
          {uploading && <p className="mt-4">Memproses {filename}. Tunggu hingga halaman pratinjau terbuka.</p>}
        </div>
        <div aria-live="assertive" aria-atomic="true">
          {error && <p className="mt-4 rounded-md border border-wood bg-parchment p-3 text-sm text-wood">{error}</p>}
        </div>
      </section>

      <section aria-labelledby="history-title">
        <h2 id="history-title" className="mb-3 text-lg font-semibold">Riwayat impor</h2>
        {recentBatches.length === 0 ? (
          <p className="rounded-lg border border-dashed border-wood/30 p-4 text-sm text-muted">Belum ada impor. Unduh template, isi data, lalu unggah untuk memeriksanya.</p>
        ) : (
          <ul className="divide-y divide-wood/20 rounded-lg border border-wood/20 bg-cream">
            {recentBatches.map((batch) => (
              <li key={batch.id} className="flex min-w-0 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="font-semibold">{batch.filename}</h3>
                  <p className="mt-1 text-sm text-muted">{formatDate(batch.createdAt)} oleh {batch.createdBy.person.fullName}</p>
                  <p className="mt-1 text-sm">{batch.status === "COMMITTED" ? "Tersimpan" : batch.status === "FAILED" ? "Gagal" : batch.status === "VALIDATED" ? "Belum disimpan" : batch.status} · {batch.totalRows} baris · {batch.errorRows} kesalahan</p>
                </div>
                <Link href={`/admin/impor/laporan/${encodeURIComponent(batch.id)}`} aria-label={`Lihat laporan ${batch.filename}`} className={`inline-flex min-h-11 shrink-0 items-center self-start rounded-md px-3 py-2 text-sm font-semibold text-gold-deep underline hover:text-forest ${focus}`}>
                  Lihat laporan
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

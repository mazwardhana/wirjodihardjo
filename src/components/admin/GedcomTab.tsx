"use client";

import { useRef, useState } from "react";
import { formatDate } from "@/lib/utils";

/**
 * Generator GEDCOM 5.5.1 untuk halaman /admin/impor.
 *
 * Alur: upload .ged/.gedcom → validasi → pratinjau (Person + Family +
 * ringkasan analisis) → commit → rollback (batal). Semua data diambil dari
 * endpoint /api/admin/gedcom (POST upload, GET detail batch, POST commit,
 * POST rollback, GET export).
 */

type GedcomError = { record: string; line?: number; field: string; message: string };

type GedcomFamilyRow = {
  gedcomId: string;
  husband?: string;
  wife?: string;
  children: string[];
  marriageDateRaw?: string;
  divorceDateRaw?: string;
  status: string;
};

type GedcomPreviewRow = {
  gedcomId: string;
  fullName: string;
  gender: string;
  status: "baru" | "dilewati";
  reason?: string;
};

type GedcomDetail = {
  batchId: string;
  filename: string;
  status: string;
  rolledBackAt: string | null;
  createdAt: string;
  valid: boolean;
  totalRows: number;
  counts: {
    total: number;
    personsCreated: number;
    personsSkipped: number;
    childEdgesCreated: number;
    partnerEdgesCreated: number;
  };
  errors: GedcomError[];
  warnings: string[];
  families: GedcomFamilyRow[];
  preview: GedcomPreviewRow[];
  canCommit: boolean;
  canRollback: boolean;
};

const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest";

function errorText(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  return "Terjadi kesalahan. Periksa koneksi lalu coba lagi.";
}

export function GedcomTab() {
  const fileInput = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [detail, setDetail] = useState<GedcomDetail | null>(null);
  const [commitBusy, setCommitBusy] = useState(false);
  const [rollbackBusy, setRollbackBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  async function loadDetail(batchId: string) {
    const response = await fetch(`/api/admin/gedcom/${encodeURIComponent(batchId)}`);
    const data: unknown = await response.json();
    if (!response.ok) {
      throw new Error(
        typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
          ? data.error
          : "Gagal memuat detail batch.",
      );
    }
    setDetail(data as GedcomDetail);
  }

  async function upload(files: FileList | null) {
    if (inFlight.current || !files?.length) return;
    setError(null);
    setActionMsg(null);
    if (files.length !== 1) {
      setError("Pilih satu file untuk setiap impor GEDCOM.");
      return;
    }
    const file = files[0];
    if (!/\.(ged|gedcom)$/i.test(file.name)) {
      setError("Format file harus .ged atau .gedcom.");
      return;
    }
    if (file.size === 0) {
      setError("File kosong. Pilih file GEDCOM yang sudah diisi.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Ukuran file melebihi 10MB. Kurangi isinya lalu unggah ulang.");
      return;
    }

    inFlight.current = true;
    setBusy(true);
    setUploadName(file.name);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/admin/gedcom", { method: "POST", body: formData });
      const data: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
            ? data.error
            : "Unggahan gagal. Periksa koneksi lalu coba lagi.",
        );
      }
      const batchId =
        typeof data === "object" && data !== null && "batchId" in data && typeof data.batchId === "string"
          ? data.batchId
          : null;
      if (!batchId) throw new Error("Respons unggahan tidak lengkap. Muat ulang lalu coba lagi.");
      await loadDetail(batchId);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function commit() {
    if (!detail || commitBusy || rollbackBusy) return;
    setError(null);
    setActionMsg(null);
    setCommitBusy(true);
    try {
      const response = await fetch("/api/admin/gedcom/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: detail.batchId }),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
            ? data.error
            : "Commit gagal. Periksa koneksi lalu coba lagi.",
        );
      }
      await loadDetail(detail.batchId);
      setActionMsg("Data berhasil disimpan (commit).");
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setCommitBusy(false);
    }
  }

  async function rollback() {
    if (!detail || rollbackBusy || commitBusy) return;
    const confirmed = window.confirm(
      "Batalkan impor ini? Semua orang dan relasi yang dibuat dari file ini akan dihapus. Tindakan ini tidak dapat dibatalkan.",
    );
    if (!confirmed) return;
    setError(null);
    setActionMsg(null);
    setRollbackBusy(true);
    try {
      const response = await fetch("/api/admin/gedcom/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: detail.batchId }),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
            ? data.error
            : "Rollback gagal. Periksa koneksi lalu coba lagi.",
        );
      }
      await loadDetail(detail.batchId);
      setActionMsg("Impor dibatalkan (rollback). Semua data dari file ini telah dihapus.");
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setRollbackBusy(false);
    }
  }

  const waiting = busy || commitBusy || rollbackBusy;
  const duplicateCount = detail
    ? detail.preview.filter((row) => row.status === "dilewati").length
    : 0;
  const missingParentCount = detail
    ? detail.errors.filter(
        (err) =>
          (err.field === "HUSB/WIFE" || err.field === "CHIL") &&
          err.message.includes("tidak ditemukan"),
      ).length
    : 0;

  return (
    <div className="space-y-6">
      {/* Status/aksi utama */}
      {!detail && (
        <section className="rounded-lg border border-wood/20 bg-cream p-4 sm:p-6" aria-labelledby="gedcom-upload-title">
          <h2 id="gedcom-upload-title" className="text-lg font-semibold">
            Unggah file GEDCOM
          </h2>
          <p className="mt-1 text-sm text-muted">
            File .ged / .gedcom (format GEDCOM 5.5.1) berisi data silsilah (orang + keluarga).
            Data belum disimpan sebelum Anda menyetujui pratinjau.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="/api/admin/gedcom/export"
              download
              className={`inline-flex min-h-11 items-center rounded-md border border-wood px-4 py-2 text-sm font-semibold hover:bg-parchment ${focus}`}
            >
              Unduh data keluarga sebagai GEDCOM
            </a>
            <input
              ref={fileInput}
              type="file"
              accept=".ged,.gedcom"
              disabled={busy}
              className="hidden"
              aria-label="Pilih file GEDCOM"
              onChange={(event) => {
                void upload(event.currentTarget.files);
                event.currentTarget.value = "";
              }}
            />
            <button
              type="button"
              disabled={busy}
              aria-busy={busy}
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
              <span className="font-semibold">
                {busy ? `Mengunggah dan memvalidasi ${uploadName}...` : dragging ? "Lepaskan file untuk mengunggah" : "Pilih atau seret file ke sini"}
              </span>
              <span className="text-sm text-muted">GEDCOM (.ged/.gedcom), maksimal 10MB.</span>
            </button>
          </div>
        </section>
      )}

      {detail && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">Pratinjau GEDCOM</h2>
              <p className="mt-1 break-all text-sm text-muted">
                {detail.filename} · diunggah {formatDate(detail.createdAt)} · {detail.totalRows} orang
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="/api/admin/gedcom/export"
                download
                className={`inline-flex min-h-11 items-center rounded-md border border-wood px-4 py-2 text-sm font-semibold hover:bg-parchment ${focus}`}
              >
                Unduh GEDCOM
              </a>
              {detail.canCommit && (
                <button
                  type="button"
                  disabled={commitBusy || rollbackBusy}
                  aria-busy={commitBusy}
                  onClick={() => void commit()}
                  className={`inline-flex min-h-11 items-center rounded-md bg-forest px-4 py-2 text-sm font-semibold text-cream hover:bg-forest/90 disabled:cursor-wait ${focus}`}
                >
                  {commitBusy ? "Menyimpan..." : "Simpan data (commit)"}
                </button>
              )}
              {detail.canRollback && (
                <button
                  type="button"
                  disabled={rollbackBusy || commitBusy}
                  aria-busy={rollbackBusy}
                  onClick={() => void rollback()}
                  className={`inline-flex min-h-11 items-center rounded-md border border-red-800/40 bg-red-800/5 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-800/10 disabled:cursor-wait ${focus}`}
                >
                  {rollbackBusy ? "Membatalkan..." : "Batalkan impor (rollback)"}
                </button>
              )}
            </div>
          </div>

          <div role="status" aria-live="polite">
            {actionMsg && (
              <p className="rounded-md border border-wood bg-parchment p-3 text-sm text-wood">{actionMsg}</p>
            )}
          </div>
          <div aria-live="assertive" aria-atomic="true">
            {error && (
              <p className="rounded-md border border-red-800/40 bg-red-800/5 p-3 text-sm text-red-800">{error}</p>
            )}
          </div>

          {detail.status === "COMMITTED" && (
            <p className="rounded-md border border-green-800/40 bg-green-800/5 p-3 text-sm text-green-800">
              Batch ini sudah disimpan. {detail.rolledBackAt ? `Dibatalkan pada ${formatDate(detail.rolledBackAt)}.` : "Jika ada kesalahan, Anda dapat membatalkannya dengan tombol rollback di atas."}
            </p>
          )}

          {/* Ringkasan analisis */}
          <section aria-labelledby="gedcom-summary-title" className="rounded-lg border border-wood/20 bg-cream p-4">
            <h3 id="gedcom-summary-title" className="font-semibold">
              Ringkasan analisis
            </h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div className="rounded-md bg-parchment p-3">
                <dt className="text-muted">Orang baru</dt>
                <dd className="mt-1 text-xl font-bold text-forest">{detail.counts.personsCreated}</dd>
              </div>
              <div className="rounded-md bg-parchment p-3">
                <dt className="text-muted">Dilewati (sudah ada / duplikat)</dt>
                <dd className="mt-1 text-xl font-bold text-forest">{detail.counts.personsSkipped}</dd>
              </div>
              <div className="rounded-md bg-parchment p-3">
                <dt className="text-muted">Relasi anak-orang tua</dt>
                <dd className="mt-1 text-xl font-bold text-forest">{detail.counts.childEdgesCreated}</dd>
              </div>
              <div className="rounded-md bg-parchment p-3">
                <dt className="text-muted">Relasi pasangan</dt>
                <dd className="mt-1 text-xl font-bold text-forest">{detail.counts.partnerEdgesCreated}</dd>
              </div>
            </dl>
            <ul className="mt-4 space-y-1 text-sm text-muted">
              {duplicateCount > 0 && (
                <li>• {duplicateCount} orang direncanakan dilewati karena sudah ada di database atau muncul dua kali di file.</li>
              )}
              {missingParentCount > 0 && (
                <li>• {missingParentCount} referensi orang tua/anak pada keluarga tidak ditemukan di file (akan dilewati).</li>
              )}
              {detail.warnings.length > 0 && (
                <li>• {detail.warnings.length} peringatan: {detail.warnings.slice(0, 3).join("; ")}{detail.warnings.length > 3 ? "…" : ""}</li>
              )}
              {detail.errors.length > 0 && (
                <li className="text-red-800">• {detail.errors.length} kesalahan validasi — periksa tabel di bawah sebelum menyimpan.</li>
              )}
              {duplicateCount === 0 && missingParentCount === 0 && detail.warnings.length === 0 && detail.errors.length === 0 && (
                <li>• Tidak ada masalah terdeteksi.</li>
              )}
            </ul>
          </section>

          {/* Tabel Person */}
          <section aria-labelledby="gedcom-persons-title">
            <h3 id="gedcom-persons-title" className="mb-3 font-semibold">
              Orang ({detail.preview.length > detail.totalRows ? `${detail.totalRows} ditampilkan` : `${detail.preview.length} dari ${detail.totalRows} ditampilkan`})
            </h3>
            <div className="overflow-x-auto rounded-lg border border-wood/20 bg-cream">
              <table className="w-full min-w-160 text-left text-sm">
                <thead className="border-b border-wood/20 text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-3">ID GEDCOM</th>
                    <th scope="col" className="px-4 py-3">Nama</th>
                    <th scope="col" className="px-4 py-3">Jenis kelamin</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                    <th scope="col" className="px-4 py-3">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-wood/20">
                  {detail.preview.map((row) => (
                    <tr key={row.gedcomId}>
                      <td className="px-4 py-3 font-mono text-xs text-muted">{row.gedcomId}</td>
                      <td className="px-4 py-3 font-medium">{row.fullName}</td>
                      <td className="px-4 py-3">
                        {row.gender === "MALE" ? "Laki-laki" : row.gender === "FEMALE" ? "Perempuan" : "Lainnya"}
                      </td>
                      <td className="px-4 py-3">
                        {row.status === "baru" ? (
                          <span className="rounded-full bg-green-800/10 px-2 py-0.5 text-xs font-semibold text-green-800">baru</span>
                        ) : (
                          <span className="rounded-full bg-wood/10 px-2 py-0.5 text-xs font-semibold text-wood">dilewati</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted">{row.reason ?? "—"}</td>
                    </tr>
                  ))}
                  {detail.preview.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-muted">Tidak ada baris orang ditampilkan.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Tabel Family */}
          <section aria-labelledby="gedcom-families-title">
            <h3 id="gedcom-families-title" className="mb-3 font-semibold">
              Keluarga ({detail.families.length})
            </h3>
            {detail.families.length === 0 ? (
              <p className="rounded-lg border border-dashed border-wood/30 p-4 text-sm text-muted">
                Tidak ada catatan keluarga (FAM) di file ini.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-wood/20 bg-cream">
                <table className="w-full min-w-160 text-left text-sm">
                  <thead className="border-b border-wood/20 text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th scope="col" className="px-4 py-3">ID Keluarga</th>
                      <th scope="col" className="px-4 py-3">Pasangan</th>
                      <th scope="col" className="px-4 py-3">Anak</th>
                      <th scope="col" className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-wood/20">
                    {detail.families.map((family) => (
                      <tr key={family.gedcomId}>
                        <td className="px-4 py-3 font-mono text-xs text-muted">{family.gedcomId}</td>
                        <td className="px-4 py-3">
                          {family.husband && family.wife
                            ? `${family.husband} & ${family.wife}`
                            : family.husband ?? family.wife ?? "—"}
                        </td>
                        <td className="px-4 py-3">{family.children.length > 0 ? family.children.join(", ") : "—"}</td>
                        <td className="px-4 py-3">{family.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

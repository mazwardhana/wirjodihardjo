"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ImportErrorTable } from "./ImporReport";
import type { ImportCounts, ImportCredential, ParsedData, ValidationError } from "@/lib/import/types";

const tabs = ["Anggota", "Relasi", "Akun"] as const;
type Sheet = (typeof tabs)[number];
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
  const [activeTab, setActiveTab] = useState<Sheet>("Anggota");
  const [page, setPage] = useState(0);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const inFlight = useRef(false);
  const totalRows = preview ? preview.anggota.length + preview.relasi.length + preview.akun.length : 0;
  const blocked = errors.length > 0 || !preview || !counts || totalRows === 0;
  const countsBySheet = { Anggota: preview?.anggota.length ?? 0, Relasi: preview?.relasi.length ?? 0, Akun: preview?.akun.length ?? 0 };
  const rows = activeTab === "Anggota"
    ? (preview?.anggota ?? []).map((row, index) => ({ number: row._row ?? index + 2, cells: [row.ref, row.namaLengkap, row.jenisKelamin, row.tanggalLahir || "Belum diisi", row.cabang || "Belum diisi"] }))
    : activeTab === "Relasi"
      ? (preview?.relasi ?? []).map((row, index) => ({ number: row._row ?? index + 2, cells: [row.refOrang, row.jenisRelasi, row.refTarget, row.peranOrangTua || row.statusPasangan || "Belum diisi"] }))
      : (preview?.akun ?? []).map((row, index) => ({ number: row._row ?? index + 2, cells: [row.ref, row.email, row.peran] }));
  const columns = activeTab === "Anggota" ? ["Ref", "Nama", "Jenis kelamin", "Tanggal lahir", "Cabang"] : activeTab === "Relasi" ? ["Ref", "Jenis relasi", "Target", "Peran / status"] : ["Ref", "Email", "Peran"];
  const invalidRows = new Set(errors.filter((entry) => entry.sheet === activeTab).map((entry) => entry.row));
  const pageSize = 20;

  function selectTab(sheet: Sheet) {
    setActiveTab(sheet);
    setPage(0);
  }

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
              ["Anggota baru", counts.personsCreated], ["Anggota diperbarui", counts.personsUpdated],
              ["Akun baru", counts.accountsCreated], ["Akun diperbarui", counts.accountsUpdated],
              ["Relasi orang tua-anak", counts.childEdgesCreated], ["Relasi pasangan", counts.partnerEdgesCreated],
              ["Data privat", counts.privateUpserts],
            ] as const).map(([label, value]) => <div key={label} className="flex justify-between gap-3 border-b border-wood/10 pb-2"><dt className="text-muted">{label}</dt><dd className="font-semibold">{value}</dd></div>)}
          </dl>
        </section>
      )}
      {preview ? (
        <section className="min-w-0 rounded-lg border border-wood/20 bg-cream p-3 sm:p-4">
          <h2 className="mb-3 font-semibold">Pratinjau per sheet</h2>
          <div role="tablist" aria-label="Sheet impor" className="flex flex-wrap gap-2 border-b border-wood/20 pb-3">
            {tabs.map((sheet, index) => (
              <button key={sheet} type="button" role="tab" id={`tab-${sheet}`} aria-controls="sheet-panel" aria-selected={activeTab === sheet} tabIndex={activeTab === sheet ? 0 : -1}
                onClick={() => selectTab(sheet)}
                onKeyDown={(event) => {
                  const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
                  if (next === null) return;
                  event.preventDefault();
                  selectTab(tabs[next]);
                  document.getElementById(`tab-${tabs[next]}`)?.focus();
                }}
                className={`${buttonStyle} ${activeTab === sheet ? "bg-forest text-cream" : "bg-cream hover:bg-parchment"}`}>
                {sheet} ({countsBySheet[sheet]})
              </button>
            ))}
          </div>
          <div id="sheet-panel" role="tabpanel" aria-labelledby={`tab-${activeTab}`} tabIndex={0} className={`mt-3 ${focus}`}>
            {activeTab === "Akun" && <p className="mb-3 text-sm text-muted">Password tidak ditampilkan. Setelah impor disimpan, unduh kredensial CSV melalui halaman laporan. {credentials.filter((entry) => entry.isNew).length} akun baru direncanakan.</p>}
            {rows.length === 0 ? (
              <p className="py-6 text-sm text-muted">Sheet {activeTab} tidak berisi baris data. {activeTab === "Anggota" ? "Isi sheet Anggota pada file sumber sebelum mengunggah ulang." : `Tidak ada ${activeTab.toLowerCase()} yang akan diimpor dari sheet ini.`}</p>
            ) : (
              <>
                <table role="table" className="block w-full text-left text-sm lg:table lg:table-fixed">
                  <caption className="sr-only">Pratinjau {activeTab}</caption>
                  <thead role="rowgroup" className="sr-only lg:not-sr-only lg:table-header-group"><tr role="row">{["Baris", ...columns, "Status"].map((column) => <th key={column} scope="col" className="p-2">{column}</th>)}</tr></thead>
                  <tbody role="rowgroup" className="block lg:table-row-group">
                    {rows.slice(page * pageSize, (page + 1) * pageSize).map((row) => (
                      <tr role="row" key={row.number} className="block border-t border-wood/20 py-3 lg:table-row">
                        {[String(row.number), ...row.cells, invalidRows.has(row.number) || invalidRows.has(0) ? "Perlu diperbaiki" : "Lolos validasi baris"].map((cell, index) => (
                          <td role="cell" key={index} className="block min-w-0 px-2 py-1 align-top text-muted lg:table-cell lg:py-3"><span aria-hidden="true" className="mr-2 font-semibold text-forest lg:hidden">{["Baris", ...columns, "Status"][index]}:</span>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <p role="status" className="text-sm text-muted">Baris {page * pageSize + 1} sampai {Math.min((page + 1) * pageSize, rows.length)} dari {rows.length}</p>
                  {rows.length > pageSize && <>
                    <button type="button" disabled={page === 0} onClick={() => setPage((value) => value - 1)} className={`${buttonStyle} disabled:opacity-50`}>Sebelumnya</button>
                    <button type="button" disabled={(page + 1) * pageSize >= rows.length} onClick={() => setPage((value) => value + 1)} className={`${buttonStyle} disabled:opacity-50`}>Berikutnya</button>
                  </>}
                </div>
              </>
            )}
          </div>
        </section>
      ) : <p className="rounded-lg border border-wood p-4 text-sm text-muted">Pratinjau tidak tersedia. Data tidak dapat disimpan dari halaman ini. Kembali ke impor untuk memeriksa riwayat atau mengunggah ulang.</p>}
      <div className="sticky bottom-0 z-20 rounded-t-lg border border-wood/30 bg-cream p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <p role="status" className="mb-2 text-sm text-muted">{committing ? "Menyimpan data. Tunggu hingga laporan terbuka." : blocked ? "Penyimpanan nonaktif. Periksa kesalahan atau data yang belum tersedia." : "Data belum disimpan. Periksa semua sheet sebelum melanjutkan."}</p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => setConfirming(true)} disabled={blocked || committing} aria-busy={committing} className={`${buttonStyle} bg-forest text-cream hover:bg-forest-soft disabled:cursor-not-allowed disabled:opacity-50`}>{committing ? "Menyimpan..." : "Simpan ke database"}</button>
          {!committing && <Link href="/admin/impor" className={`inline-flex items-center ${buttonStyle}`}>Kembali ke impor</Link>}
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
    <dialog ref={dialog} aria-labelledby="commit-title" aria-describedby="commit-description" onCancel={(event) => { event.preventDefault(); onCancel(); }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = dialog.current?.querySelectorAll<HTMLButtonElement>("button");
        if (!controls?.length) return;
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-lg border border-wood bg-cream p-5 text-forest backdrop:bg-forest/60 [overflow-wrap:anywhere]">
      <h2 id="commit-title" className="font-display text-xl font-semibold">Simpan data keluarga?</h2>
      <p id="commit-description" className="mt-3 text-sm text-muted">Data dari {filename} akan menambah atau memperbarui anggota, relasi, dan akun. Tidak ada pembatalan otomatis setelah penyimpanan.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button ref={cancel} type="button" onClick={onCancel} className={buttonStyle}>Periksa lagi</button>
        <button type="button" onClick={onConfirm} className={`${buttonStyle} bg-forest text-cream hover:bg-forest-soft`}>Ya, simpan data</button>
      </div>
    </dialog>
  );
}

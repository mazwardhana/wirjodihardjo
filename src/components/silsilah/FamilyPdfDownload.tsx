"use client";

import { useState } from "react";
import { buildFamilyReportPdf, type FamilyReport } from "@/lib/pdf-family-report";

export function FamilyPdfDownload() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/export/family-report", { credentials: "same-origin" });
      if (!response.ok) {
        setError(response.status === 401 ? "Masuk untuk mengunduh laporan." : "Laporan belum dapat dibuat. Coba lagi.");
        return;
      }
      const report = (await response.json()) as FamilyReport;
      const bytes = buildFamilyReportPdf(report);
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "laporan-silsilah-keluarga.pdf";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Laporan belum dapat dibuat.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={handleDownload}
        disabled={busy}
        className="inline-flex min-h-11 items-center rounded-md border border-wood/35 bg-cream px-4 py-2 text-sm font-medium text-forest transition-colors hover:border-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:opacity-60"
      >
        {busy ? "Menyiapkan PDF…" : "Unduh laporan PDF"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-wood">
          {error}
        </p>
      )}
    </div>
  );
}
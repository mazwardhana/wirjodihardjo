"use client";

/**
 * Tombol cetak: memakai window.print() dengan @media print yang menyembunyikan
 * segala hal kecuali area QR (kelas print-area di halaman admin reuni).
 * Terpisah dari panel server karena butuh API browser.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-11 items-center justify-center rounded-sm border border-wood/35 px-4 py-2.5 text-sm font-semibold text-wood transition-colors hover:bg-wood/10 print:hidden"
    >
      Cetak
    </button>
  );
}

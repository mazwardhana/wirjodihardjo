import type { ReactNode } from "react";

/**
 * State kosong yang jujur: tanpa konten karangan.
 * Alasan: PRD R-38, bagian kosong lebih baik daripada data fiktif.
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-wood/30 bg-parchment/40 px-6 py-14 text-center">
      <h2 className="font-display text-lg font-semibold text-forest">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
        {description}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = "Memuat data" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-3 py-14 text-sm text-muted"
    >
      <span
        className="h-4 w-4 animate-spin rounded-full border-2 border-wood/30 border-t-forest"
        aria-hidden="true"
      />
      {label}…
    </div>
  );
}

export function ErrorState({
  title = "Data gagal dimuat",
  description = "Periksa koneksi Anda lalu coba lagi.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-wood/30 bg-parchment/60 px-6 py-12 text-center"
    >
      <h2 className="font-display text-lg font-semibold text-wood">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{description}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 rounded-md border border-forest/30 px-5 py-2.5 text-sm font-semibold text-forest transition-colors hover:bg-forest hover:text-cream"
        >
          Coba lagi
        </button>
      )}
    </div>
  );
}
"use client";

import { Dialog } from "./Dialog";

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "Konfirmasi",
  message = "Anda yakin?",
  confirmLabel = "Ya, hapus",
  cancelLabel = "Batal",
  variant = "danger",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <p className="text-sm leading-relaxed text-muted">{message}</p>
      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-wood/30 px-4 py-2 text-sm font-medium text-muted hover:bg-wood/10"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={`rounded-md px-4 py-2 text-sm font-semibold text-cream ${
            variant === "danger"
              ? "bg-wood hover:bg-wood-soft"
              : "bg-forest hover:bg-forest-soft"
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
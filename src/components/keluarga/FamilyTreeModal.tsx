"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";

export type FamilyTreeModalProps = {
  personId: string;
  branchId: string;
  onClose: () => void;
};

/**
 * STUB untuk Task C (wave 2).
 * Kontrak props ini TIDAK BOLEH berubah. Bagian internal akan diisi oleh
 * agent lain untuk mengelola logika relasi generasi.
 */
export function FamilyTreeModal({ personId, branchId, onClose }: FamilyTreeModalProps) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`/api/admin/keluarga/relasi?personId=${encodeURIComponent(personId)}`)
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [personId]);

  return (
    <Dialog
      open
      onClose={onClose}
      title="Form Family Tree"
      description="Tetapkan posisi anggota ini di dalam pohon keluarga."
      size="lg"
    >
      <dl className="space-y-2 text-sm">
        <div className="flex items-start justify-between gap-4">
          <dt className="text-muted">Cabang</dt>
          <dd className="text-right font-medium text-forest break-all">{branchId}</dd>
        </div>
        <div className="flex items-start justify-between gap-4">
          <dt className="text-muted">ID Anggota</dt>
          <dd className="text-right font-medium text-forest break-all">{personId}</dd>
        </div>
      </dl>

      <div
        role="status"
        className="mt-5 rounded-md border border-dashed border-wood/25 bg-parchment/40 p-8 text-center text-sm text-muted"
      >
        {loading ? "Memuat data relasi..." : "Data relasi sedang disiapkan"}
      </div>
    </Dialog>
  );
}

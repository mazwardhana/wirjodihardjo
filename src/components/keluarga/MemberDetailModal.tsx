"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";

export type MemberDetailModalProps = {
  personId: string;
  onClose: () => void;
};

/**
 * STUB untuk Task C (wave 2).
 * Kontrak props ini TIDAK BOLEH berubah. Bagian internal akan diisi oleh
 * agent lain untuk menampilkan detail relasi anggota.
 */
export function MemberDetailModal({ personId, onClose }: MemberDetailModalProps) {
  const [fullName, setFullName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`/api/admin/anggota?id=${encodeURIComponent(personId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data && typeof data.fullName === "string") {
          setFullName(data.fullName);
        }
      })
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
      title={fullName ?? "Detail Anggota"}
      description="Ringkasan data anggota dan hubungan keluarganya."
      size="lg"
    >
      <div
        role="status"
        className="rounded-md border border-dashed border-wood/25 bg-parchment/40 p-8 text-center text-sm text-muted"
      >
        {loading ? "Memuat detail anggota..." : "Detail anggota sedang disiapkan"}
      </div>
    </Dialog>
  );
}

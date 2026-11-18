"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnggotaForm } from "@/components/admin/AnggotaForm";
import { Dialog } from "@/components/ui/Dialog";

/**
 * Modal tambah anggota di halaman daftar (O3). Konsisten dengan pola create
 * modal admin lain (ReunionCreateModal, AlbumCreateModal, dst.): satu klik
 * dari list, form sama dengan halaman /admin/anggota/tambah, tanpa pindah
 * halaman. Rute /admin/anggota/tambah tetap ada sebagai jalur langsung.
 */
export function AnggotaCreateModal({
  branches,
  defaultBranchId,
  lockBranch = false,
}: {
  branches: { id: string; name: string }[];
  defaultBranchId?: string;
  lockBranch?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleSuccess = () => {
    setOpen(false);
    router.refresh();
  };

  const handleCancel = () => {
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 rounded-md bg-forest px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
      >
        Tambah Anggota
      </button>
      <Dialog
        open={open}
        onClose={handleCancel}
        title="Tambah Anggota"
        description="Data anggota baru akan langsung tersimpan di database."
        size="lg"
      >
        <AnggotaForm
          branches={branches}
          defaultBranchId={defaultBranchId}
          lockBranch={lockBranch}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </Dialog>
    </>
  );
}

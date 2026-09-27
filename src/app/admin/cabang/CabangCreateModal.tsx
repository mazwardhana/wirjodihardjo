"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { CabangForm } from "@/components/admin/CabangForm";

export function CabangCreateModal() {
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
        className="min-h-11 rounded-md bg-forest px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft"
      >
        Tambah Cabang
      </button>
      <Dialog
        open={open}
        onClose={handleCancel}
        title="Tambah Cabang Baru"
        description="Buat cabang keluarga baru untuk mengelompokkan anggota berdasarkan wilayah atau garis keluarga."
        size="lg"
      >
        <CabangForm mode="create" onSuccess={handleSuccess} onCancel={handleCancel} />
      </Dialog>
    </>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { HallOfFameForm } from "@/components/admin/HallOfFameForm";

export function HallOfFameCreateModal() {
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
        Tambah Entri
      </button>
      <Dialog
        open={open}
        onClose={handleCancel}
        title="Tambah Entri Hall of Fame"
        description="Buat entri baru untuk mengapresiasi anggota keluarga."
        size="lg"
      >
        <HallOfFameForm onSuccess={handleSuccess} onCancel={handleCancel} />
      </Dialog>
    </>
  );
}

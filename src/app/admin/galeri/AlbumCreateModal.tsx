"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { AlbumForm } from "@/components/admin/AlbumForm";

export function AlbumCreateModal() {
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
        className="min-h-11 rounded-md bg-gold px-4 py-2 text-sm font-semibold text-forest transition-colors hover:bg-gold-deep"
      >
        + Album Baru
      </button>
      <Dialog
        open={open}
        onClose={handleCancel}
        title="Album Baru"
        description="Buat album foto baru untuk mendokumentasikan acara atau momen keluarga."
        size="md"
      >
        <AlbumForm onSuccess={handleSuccess} onCancel={handleCancel} />
      </Dialog>
    </>
  );
}

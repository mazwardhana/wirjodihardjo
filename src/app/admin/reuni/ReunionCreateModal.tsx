"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { ReunionForm } from "@/components/admin/ReunionForm";

export function ReunionCreateModal() {
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
        className="min-h-11 rounded-md bg-gold px-4 py-2.5 text-sm font-semibold text-forest transition-colors hover:bg-gold-deep"
      >
        Reuni Baru
      </button>
      <Dialog
        open={open}
        onClose={handleCancel}
        title="Buat Reuni Baru"
        description="Isi detail acara reuni keluarga. Status awal adalah draf, terbitkan setelah semuanya siap."
        size="xl"
      >
        <ReunionForm isEdit={false} onSuccess={handleSuccess} onCancel={handleCancel} />
      </Dialog>
    </>
  );
}

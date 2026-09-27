"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { PenggunaForm } from "@/components/admin/PenggunaForm";

export function PenggunaCreateModal({ persons }: { persons: { id: string; fullName: string }[] }) {
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
        Tambah pengguna
      </button>
      <Dialog
        open={open}
        onClose={handleCancel}
        title="Buat Akun Pengguna"
        description="Buat akun baru untuk anggota keluarga. Anggota tanpa akun ditampilkan di bawah."
        size="md"
      >
        {persons.length === 0 ? (
          <p className="text-sm text-muted">Semua anggota sudah memiliki akun.</p>
        ) : (
          <PenggunaForm persons={persons} onSuccess={handleSuccess} onCancel={handleCancel} />
        )}
      </Dialog>
    </>
  );
}

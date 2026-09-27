"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { ArticleCategoryManager } from "@/components/admin/ArticleCategoryManager";

type Kategori = {
  id: string;
  name: string;
  slug: string;
  _count: { articles: number };
};

export function KategoriModal({ initial }: { initial: Kategori[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleClose = () => {
    setOpen(false);
    router.refresh();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-wood/30 px-4 py-2 text-sm font-semibold text-forest transition-colors hover:bg-wood/10"
      >
        Kelola Kategori
      </button>

      <Dialog
        open={open}
        onClose={handleClose}
        title="Kelola Kategori Artikel"
        description="Tambah, ubah, atau hapus kategori artikel. Kategori yang masih digunakan oleh artikel tidak bisa dihapus."
        size="lg"
      >
        <ArticleCategoryManager initial={initial} />
      </Dialog>
    </>
  );
}

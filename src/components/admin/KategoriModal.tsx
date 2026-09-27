"use client";

import { useState } from "react";
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
        onClose={() => setOpen(false)}
        title="Kelola Kategori Artikel"
        description="Tambah, ubah, atau hapus kategori artikel. Kategori yang masih digunakan oleh artikel tidak bisa dihapus."
        size="lg"
      >
        <ArticleCategoryManager initial={initial} />
      </Dialog>
    </>
  );
}

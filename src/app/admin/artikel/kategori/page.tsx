import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArticleCategoryManager } from "@/components/admin/ArticleCategoryManager";

export const dynamic = "force-dynamic";

export default async function AdminArtikelKategoriPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || user.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  const categories = await prisma.articleCategory.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { articles: true } },
    },
  });

  return (
    <div className="p-8">
      <Link
        href="/admin/artikel"
        className="text-sm text-muted underline hover:text-forest"
      >
        ← Moderasi Artikel
      </Link>

      <div className="mt-6 max-w-2xl">
        <h1 className="font-display text-2xl font-semibold text-forest">
          Kelola Kategori Artikel
        </h1>
        <p className="mt-2 text-sm text-muted">
          Tambah, ubah, atau hapus kategori artikel. Kategori yang masih
          digunakan oleh artikel tidak bisa dihapus.
        </p>

        <div className="mt-8">
          <ArticleCategoryManager initial={categories} />
        </div>
      </div>
    </div>
  );
}

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArticleForm } from "@/components/artikel/ArticleForm";

export const dynamic = "force-dynamic";

export default async function DashboardArtikelBaruPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const categories = await prisma.articleCategory.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Link
        href="/dashboard/artikel"
        className="text-sm text-muted underline hover:text-forest"
      >
        ← Artikel Saya
      </Link>
      <h1 className="mt-4 font-display text-3xl font-semibold text-forest">
        Tulis Artikel
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Ceritakan sejarah keluarga, biografi anggota, kenangan, atau prestasi.
        Artikel akan dikirim ke admin untuk ditinjau sebelum terbit.
      </p>

      {categories.length === 0 ? (
        <p className="mt-8 rounded-md border border-dashed border-wood/30 bg-parchment/40 p-6 text-sm text-muted">
          Belum ada kategori artikel. Hubungi admin untuk menambahkan kategori
          terlebih dahulu.
        </p>
      ) : (
        <div className="mt-8">
          <ArticleForm categories={categories} />
        </div>
      )}
    </div>
  );
}

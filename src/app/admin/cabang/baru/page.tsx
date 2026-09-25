import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { CabangForm } from "@/components/admin/CabangForm";

export default async function AdminCabangBaruPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "SUPER_ADMIN") redirect("/dashboard");

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-semibold text-forest">Tambah Cabang Baru</h1>
      <p className="mt-1 text-sm text-muted">
        Buat cabang keluarga baru untuk mengelompokkan anggota berdasarkan wilayah atau garis keluarga.
      </p>
      <div className="mt-8">
        <CabangForm mode="create" />
      </div>
    </div>
  );
}
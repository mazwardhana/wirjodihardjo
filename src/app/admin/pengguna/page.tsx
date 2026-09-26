import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PenggunaList } from "@/components/admin/PenggunaList";

export default async function AdminPenggunaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (admin?.role !== "SUPER_ADMIN") redirect("/dashboard");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      isVerified: true,
      person: { select: { id: true, fullName: true } },
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-semibold text-forest">Kelola Pengguna</h1>
      <p className="mt-2 text-sm text-muted">
        Kelola akun, peran, dan status verifikasi anggota keluarga.
      </p>
      <PenggunaList users={users} />
    </div>
  );
}

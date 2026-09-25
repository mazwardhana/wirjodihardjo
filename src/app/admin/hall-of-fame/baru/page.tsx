import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { HallOfFameForm } from "@/components/admin/HallOfFameForm";

export default async function AdminHallOfFameBaruPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "BRANCH_ADMIN")) {
    redirect("/dashboard");
  }

  return (
    <div className="p-8">
      <h1 className="font-display text-2xl font-semibold text-forest">Tambah Entri Hall of Fame</h1>
      <p className="mt-1 text-sm text-muted">
        Buat entri baru untuk mengapresiasi anggota keluarga.
      </p>

      <div className="mt-8">
        <HallOfFameForm />
      </div>
    </div>
  );
}
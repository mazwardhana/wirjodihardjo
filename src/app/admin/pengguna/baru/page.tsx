import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { PenggunaForm } from "@/components/admin/PenggunaForm";

export default async function PenggunaBaruPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (admin?.role !== "SUPER_ADMIN") redirect("/dashboard");

  const personsWithoutAccount = await prisma.person.findMany({
    where: { user: null, deletedAt: null },
    select: { id: true, fullName: true },
    orderBy: { fullName: "asc" },
  });

  return (
    <div className="p-8">
      <h1 className="font-display text-2xl font-semibold text-forest">Buat Akun Pengguna</h1>
      <p className="mt-1 text-sm text-muted">
        Buat akun baru untuk anggota keluarga. Anggota tanpa akun ditampilkan di bawah.
      </p>

      <div className="mt-8 max-w-xl">
        {personsWithoutAccount.length === 0 ? (
          <p className="text-sm text-muted">Semua anggota sudah memiliki akun.</p>
        ) : (
          <PenggunaForm persons={personsWithoutAccount} />
        )}
      </div>
    </div>
  );
}
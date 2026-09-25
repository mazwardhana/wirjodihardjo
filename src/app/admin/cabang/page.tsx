import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CabangCard } from "./CabangCard";

export default async function AdminCabangPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "SUPER_ADMIN") redirect("/dashboard");

  const branches = await prisma.branch.findMany({
    orderBy: { orderIndex: "asc" },
    include: {
      rootPerson: { select: { id: true, fullName: true } },
      admin: { select: { id: true, email: true, role: true, person: { select: { fullName: true } } } },
      _count: { select: { members: true } },
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-forest">Kelola Cabang</h1>
          <p className="mt-1 text-sm text-muted">{branches.length} cabang tercatat</p>
        </div>
        <Link
          href="/admin/cabang/baru"
          className="rounded-md bg-forest px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft"
        >
          Tambah Cabang
        </Link>
      </div>

      {branches.length === 0 ? (
        <div className="mt-12 rounded-lg border border-dashed border-wood/20 p-12 text-center text-sm text-muted">
          Belum ada cabang. Buat cabang pertama untuk mulai mengelola anggota keluarga berdasarkan cabang.
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((b) => (
            <CabangCard key={b.id} branch={b} />
          ))}
        </div>
      )}
    </div>
  );
}
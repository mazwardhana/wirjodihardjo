import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

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
      rootPerson: { select: { fullName: true } },
      admin: { select: { email: true } },
      _count: { select: { members: true } },
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-semibold text-forest">Kelola Cabang</h1>
      <ul className="mt-8 space-y-3">
        {branches.map((b) => (
          <li key={b.id} className="rounded-lg border border-wood/15 bg-cream p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-forest">{b.name}</p>
                {b.rootPerson && <p className="text-sm text-muted">Akar: {b.rootPerson.fullName}</p>}
                <p className="text-xs text-muted">
                  {b.admin ? `Admin: ${b.admin.email}` : "Belum ada admin"} · {b._count.members} anggota
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
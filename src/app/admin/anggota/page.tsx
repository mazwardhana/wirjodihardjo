import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { getGenerationLabel } from "@/lib/generations";
import Link from "next/link";

export default async function AdminAnggotaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, branchAdminOf: { select: { id: true } } },
  });
  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "BRANCH_ADMIN")) {
    redirect("/dashboard");
  }

  const branchId = user.branchAdminOf?.id;

  const where =
    user.role === "BRANCH_ADMIN" && branchId ? { branchId } : {};

  const persons = await prisma.person.findMany({
    where,
    orderBy: { fullName: "asc" },
    include: {
      branch: { select: { name: true } },
    },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-semibold text-forest">Data Anggota</h1>
      <p className="mt-2 text-muted">{persons.length} anggota tercatat</p>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-wood/15 text-xs font-medium uppercase tracking-wide text-muted">
              <th className="pb-3 pr-4">Anggota</th>
              <th className="pb-3 pr-4">Generasi</th>
              <th className="pb-3 pr-4">Cabang</th>
              <th className="pb-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {persons.map((p) => (
              <tr key={p.id} className="border-b border-wood/10">
                <td className="py-3 pr-4">
                  <Link href={`/profil/${p.id}`} className="flex items-center gap-3">
                    <Avatar name={p.fullName} photoUrl={p.photoUrl} size="sm" />
                    <span className="font-semibold text-forest hover:text-gold-deep">
                      {p.fullName}
                    </span>
                  </Link>
                </td>
                <td className="py-3 pr-4 text-muted">{getGenerationLabel(p.generationLevel)}</td>
                <td className="py-3 pr-4 text-muted">{p.branch?.name ?? "-"}</td>
                <td className="py-3 text-muted">{p.isDeceased ? "Wafat" : "Hidup"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
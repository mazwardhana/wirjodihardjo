import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function AdminPengajuanPage() {
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

  const query: Record<string, unknown> = { status: "PENDING" };
  if (user.role === "BRANCH_ADMIN" && branchId) {
    query.targetPerson = {
      branchId,
    };
  }

  const submissions = await prisma.submission.findMany({
    where: query as any,
    orderBy: { createdAt: "desc" },
    include: {
      submitter: {
        select: { person: { select: { fullName: true } } },
      },
      targetPerson: {
        select: { fullName: true, branch: { select: { name: true } } },
      },
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-semibold text-forest">Pengajuan Tertunda</h1>

      {submissions.length === 0 ? (
        <div className="mt-10">
          <EmptyState title="Tidak ada pengajuan tertunda" description="Semua pengajuan sudah diproses." />
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {submissions.map((s) => (
            <li key={s.id} className="rounded-lg border border-wood/15 bg-cream p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-forest">{s.type.replace(/_/g, " ")}</p>
                  <p className="text-sm text-muted">
                    Diajukan oleh: {s.submitter.person.fullName}
                  </p>
                  {s.targetPerson && (
                    <p className="text-sm text-muted">
                      Terkait: {s.targetPerson.fullName}
                      {s.targetPerson.branch && ` (${s.targetPerson.branch.name})`}
                    </p>
                  )}
                </div>
                <span className="rounded-full bg-gold/20 px-3 py-1 text-xs font-medium text-gold-deep">
                  {s.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
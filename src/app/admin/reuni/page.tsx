import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/utils";

export default async function AdminReuniPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "BRANCH_ADMIN")) {
    redirect("/dashboard");
  }

  const reunions = await prisma.reunion.findMany({
    orderBy: { startAt: "desc" },
    include: { _count: { select: { registrations: true } } },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-semibold text-forest">Kelola Reuni</h1>

      {reunions.length === 0 ? (
        <div className="mt-10">
          <EmptyState title="Belum ada reuni" description="Buat acara reuni untuk keluarga." />
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {reunions.map((r) => (
            <li key={r.id} className="rounded-lg border border-wood/15 bg-cream p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-forest">{r.title}</p>
                  <p className="text-sm text-muted">{formatDate(r.startAt)} · {r._count.registrations} peserta</p>
                </div>
                <span className="rounded-full bg-forest/10 px-3 py-1 text-xs font-medium text-forest">
                  {r.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
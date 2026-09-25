import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function AdminHallOfFamePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "BRANCH_ADMIN")) {
    redirect("/dashboard");
  }

  const entries = await prisma.hallOfFameEntry.findMany({
    orderBy: { createdAt: "desc" },
    include: { person: { select: { fullName: true } } },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-semibold text-forest">Kelola Hall of Fame</h1>

      {entries.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="Belum ada entri"
            description="Tambah entri pertama untuk mengapresiasi anggota keluarga."
          />
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {entries.map((e) => (
            <li key={e.id} className="rounded-lg border border-wood/15 bg-cream p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-forest">{e.title}</p>
                  <p className="text-sm text-muted">{e.person.fullName} · {e.category}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${e.isPublished ? "bg-forest/10 text-forest" : "bg-muted/10 text-muted"}`}>
                  {e.isPublished ? "Terbit" : "Draf"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
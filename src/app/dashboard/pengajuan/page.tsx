import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function DashboardPengajuanPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const submissions = await prisma.submission.findMany({
    where: { submittedByUserId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      targetPerson: { select: { id: true, fullName: true } },
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold text-forest">Pengajuan Saya</h1>
        <Link
          href="/dashboard/pengajuan/baru"
          className="rounded-md bg-forest px-4 py-2 text-sm font-semibold text-cream"
        >
          Ajukan Baru
        </Link>
      </div>

      {submissions.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="Belum ada pengajuan"
            description="Ajukan penambahan anggota baru atau perbaikan data lewat menu di atas."
          />
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {submissions.map((s) => (
            <li key={s.id} className="rounded-lg border border-wood/15 bg-cream p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-forest">{s.type.replace(/_/g, " ")}</p>
                  {s.targetPerson && (
                    <p className="text-sm text-muted">Terkait: {s.targetPerson.fullName}</p>
                  )}
                </div>
                <Status status={s.status} />
              </div>
              <p className="mt-1 text-xs text-muted">
                {new Date(s.createdAt).toLocaleDateString("id-ID")}
              </p>
              {s.status === "REJECTED" && s.reviewNote && (
                <p className="mt-2 rounded bg-wood/10 p-2 text-sm text-wood">
                  {s.reviewNote}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Status({ status }: { status: string }) {
  const colors = {
    PENDING: "bg-gold/20 text-gold-deep",
    APPROVED: "bg-forest/10 text-forest",
    REJECTED: "bg-wood/10 text-wood",
    CANCELLED: "bg-muted/10 text-muted",
  };
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${colors[status as keyof typeof colors] ?? colors.CANCELLED}`}>
      {status}
    </span>
  );
}
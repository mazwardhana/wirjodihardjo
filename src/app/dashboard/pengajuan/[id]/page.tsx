import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function PengajuanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const submission = await prisma.submission.findUnique({
    where: { id },
    include: {
      targetPerson: { select: { id: true, fullName: true } },
      submitter: { select: { person: { select: { fullName: true } } } },
      reviewer: { select: { person: { select: { fullName: true } } } },
    },
  });
  if (!submission || submission.submittedByUserId !== session.user.id) notFound();

  const statusColors: Record<string, string> = {
    PENDING: "bg-gold/20 text-gold-deep",
    APPROVED: "bg-forest/10 text-forest",
    REJECTED: "bg-wood/10 text-wood",
    CANCELLED: "bg-muted/10 text-muted",
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <Link
        href="/dashboard/pengajuan"
        className="text-sm text-muted underline hover:text-forest"
      >
        ← Kembali
      </Link>

      <div className="mt-6">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-semibold text-forest">
            {submission.type.replace(/_/g, " ")}
          </h1>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              statusColors[submission.status] ?? ""
            }`}
          >
            {submission.status}
          </span>
        </div>

        <dl className="mt-6 space-y-4 text-sm">
          <div className="flex justify-between border-b border-wood/10 pb-3">
            <dt className="text-muted">Diajukan oleh</dt>
            <dd className="font-medium text-forest">
              {submission.submitter.person.fullName}
            </dd>
          </div>
          {submission.targetPerson && (
            <div className="flex justify-between border-b border-wood/10 pb-3">
              <dt className="text-muted">Terkait</dt>
              <dd className="font-medium text-forest">
                <Link
                  href={`/profil/${submission.targetPerson.id}`}
                  className="underline hover:text-gold-deep"
                >
                  {submission.targetPerson.fullName}
                </Link>
              </dd>
            </div>
          )}
          <div className="flex justify-between border-b border-wood/10 pb-3">
            <dt className="text-muted">Tanggal</dt>
            <dd className="font-medium text-forest">
              {new Date(submission.createdAt).toLocaleDateString("id-ID", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </dd>
          </div>
          {submission.reviewer && (
            <div className="flex justify-between border-b border-wood/10 pb-3">
              <dt className="text-muted">Diproses oleh</dt>
              <dd className="font-medium text-forest">
                {submission.reviewer.person.fullName}
              </dd>
            </div>
          )}
          {submission.reviewNote && (
            <div className="flex justify-between border-b border-wood/10 pb-3">
              <dt className="text-muted">Catatan</dt>
              <dd className="max-w-xs text-right font-medium text-wood">
                {submission.reviewNote}
              </dd>
            </div>
          )}
        </dl>

        <div className="mt-8">
          <h2 className="font-display text-lg font-semibold text-forest">
            Data yang Diajukan
          </h2>
          <pre className="mt-3 overflow-x-auto rounded-md border border-wood/15 bg-parchment/50 p-4 text-xs text-muted">
            {JSON.stringify(submission.payload, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
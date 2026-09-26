import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ImporReport } from "@/components/admin/ImporReport";
import type { ImportBatchPayload } from "@/lib/import/types";

export const dynamic = "force-dynamic";

export default async function AdminImporLaporanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || user.role !== "SUPER_ADMIN") redirect("/dashboard");

  const batch = await prisma.importBatch.findUnique({
    where: { id },
    select: {
      id: true,
      filename: true,
      status: true,
      totalRows: true,
      successRows: true,
      errorRows: true,
      reportJson: true,
      createdAt: true,
      createdBy: { select: { person: { select: { fullName: true } } } },
    },
  });

  if (!batch) notFound();

  const payload = batch.reportJson as ImportBatchPayload | null;

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <Link
          href="/admin/impor"
          className="inline-flex min-h-11 items-center rounded-md px-2 text-sm text-muted underline hover:text-forest focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest"
        >
          Kembali ke Impor Data
        </Link>
        <h1 className="mt-2 font-display text-2xl font-semibold text-forest">Laporan Import</h1>
        <p className="mt-1 break-all text-sm text-muted">{batch.filename}</p>
      </div>

      <ImporReport
        batchId={batch.id}
        filename={batch.filename}
        status={batch.status}
        totalRows={batch.totalRows}
        successRows={batch.successRows}
        errorRows={batch.errorRows}
        createdAt={batch.createdAt}
        createdByName={batch.createdBy.person.fullName}
        payload={payload}
      />
    </div>
  );
}

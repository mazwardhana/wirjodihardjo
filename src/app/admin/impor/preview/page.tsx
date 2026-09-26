import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ImporPreview } from "@/components/admin/ImporPreview";
import type { ImportBatchPayload, ImportCounts, ImportCredential, ValidationError } from "@/lib/import/types";

export const dynamic = "force-dynamic";

export default async function AdminImporPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ batchId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || user.role !== "SUPER_ADMIN") redirect("/dashboard");

  const sp = await searchParams;
  const batchId = sp.batchId;
  if (!batchId) notFound();

  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    select: { id: true, filename: true, status: true, reportJson: true, totalRows: true },
  });

  if (!batch) notFound();

  const payload = batch.reportJson as ImportBatchPayload | null;

  return (
    <div className="min-w-0 p-4 sm:p-8 [overflow-wrap:anywhere]">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Link
            href="/admin/impor"
            className="inline-flex min-h-11 items-center rounded-md px-2 text-sm text-muted underline hover:text-forest focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest"
          >
            ← Kembali ke Impor Data
          </Link>
          <h1 className="mt-2 font-display text-2xl font-semibold text-forest">
            Pratinjau Import
          </h1>
          <p className="mt-1 text-sm text-muted">{batch.filename}</p>
        </div>
      </div>

      {batch.status !== "VALIDATED" ? (
        <div className="rounded-lg border border-wood/20 bg-cream p-6 text-center">
          <p className="text-sm text-muted">
            Batch ini sudah diproses (status: {batch.status}). Lihat laporan untuk detail.
          </p>
          <Link
            href={`/admin/impor/laporan/${batch.id}`}
            className="mt-4 inline-flex min-h-11 items-center rounded-md bg-forest px-4 py-2 text-sm font-semibold text-cream hover:bg-forest-soft focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest"
          >
            Lihat Laporan
          </Link>
        </div>
      ) : (
        <ImporPreview
          batchId={batch.id}
          filename={batch.filename}
          errors={(payload?.errors ?? []) as ValidationError[]}
          warnings={payload?.warnings ?? []}
          counts={(payload?.counts ?? null) as ImportCounts | null}
          credentials={(payload?.credentials ?? []) as ImportCredential[]}
          preview={payload?.data ?? null}
        />
      )}
    </div>
  );
}

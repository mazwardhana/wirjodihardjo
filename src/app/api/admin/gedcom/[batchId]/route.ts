import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireImportAdmin } from "@/lib/import/auth";
import { GEDCOM_IMPORT_TYPE, type GedcomBatchPayload } from "@/lib/gedcom/types";

/**
 * GET /api/admin/gedcom/:batchId — detail satu batch GEDCOM untuk pratinjau.
 * Mengembalikan ringkasan analisis (rencana per orang + counts) dan status
 * commit/rollback, dipakai tab GEDCOM di halaman /admin/impor.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const guard = await requireImportAdmin();
  if ("error" in guard) return guard.error;

  const { batchId } = await params;
  if (!batchId || batchId.length > 100) {
    return NextResponse.json({ error: "batchId tidak valid" }, { status: 400 });
  }

  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      filename: true,
      type: true,
      status: true,
      totalRows: true,
      successRows: true,
      errorRows: true,
      reportJson: true,
      rolledBackAt: true,
      createdAt: true,
    },
  });

  if (!batch || batch.type !== GEDCOM_IMPORT_TYPE) {
    return NextResponse.json({ error: "Batch tidak ditemukan." }, { status: 404 });
  }

  const payload = batch.reportJson as GedcomBatchPayload | null;

  // `planPersons` menyimpan flag `willCreate`; UI butuh `status` bertipe
  // "baru" | "dilewati". Petakan di sini supaya kontrak API = kontrak UI.
  const previewRows = (payload?.planPersons ?? []).slice(0, 100).map((row) => ({
    gedcomId: row.gedcomId,
    fullName: row.fullName,
    gender: row.gender,
    status: row.willCreate ? ("baru" as const) : ("dilewati" as const),
    reason: row.reason,
  }));

  return NextResponse.json({
    batchId: batch.id,
    filename: batch.filename,
    status: batch.status,
    rolledBackAt: batch.rolledBackAt,
    createdAt: batch.createdAt,
    valid: (payload?.errors ?? []).length === 0,
    totalRows: batch.totalRows,
    counts: payload?.counts ?? {
      total: batch.totalRows,
      personsCreated: 0,
      personsSkipped: 0,
      childEdgesCreated: 0,
      partnerEdgesCreated: 0,
    },
    errors: payload?.errors ?? [],
    warnings: payload?.warnings ?? [],
    families: payload?.data?.families ?? [],
    preview: previewRows,
    canCommit: batch.status === "VALIDATED",
    canRollback: batch.status === "COMMITTED" && !batch.rolledBackAt,
  });
}

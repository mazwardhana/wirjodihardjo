import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireImportAdmin } from "@/lib/import/auth";
import { parseXLSX, parseCSV } from "@/lib/import/parser";
import { validateImportData } from "@/lib/import/validate";
import { analyzeImportData } from "@/lib/import/importer";
import { MAX_IMPORT_BYTES } from "@/lib/import/types";

/**
 * GET /api/admin/impor — daftar batch import terakhir.
 */
export async function GET() {
  const guard = await requireImportAdmin();
  if ("error" in guard) return guard.error;

  const batches = await prisma.importBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 25,
    include: { createdBy: { select: { person: { select: { fullName: true } } } } },
  });

  return NextResponse.json(
    batches.map((b) => ({
      id: b.id,
      filename: b.filename,
      status: b.status,
      totalRows: b.totalRows,
      successRows: b.successRows,
      errorRows: b.errorRows,
      createdAt: b.createdAt,
      createdBy: b.createdBy.person.fullName,
    })),
  );
}

/**
 * POST /api/admin/impor — unggah + validasi + simpan batch (belum commit).
 */
export async function POST(request: Request) {
  const guard = await requireImportAdmin();
  if ("error" in guard) return guard.error;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Format unggahan tidak valid" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Berkas tidak ditemukan" }, { status: 400 });
  }

  if (file.size > MAX_IMPORT_BYTES) {
    return NextResponse.json({ error: "Ukuran file maksimal 10MB" }, { status: 400 });
  }

  const name = file.name.toLowerCase();
  const isXlsx = name.endsWith(".xlsx") || name.endsWith(".xlsm");
  const isCsv = name.endsWith(".csv");
  if (!isXlsx && !isCsv) {
    return NextResponse.json(
      { error: "Format harus XLSX atau CSV. Unduh template terlebih dahulu." },
      { status: 400 },
    );
  }

  let data;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    data = isCsv ? parseCSV(buffer) : await parseXLSX(buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal membaca file";
    return NextResponse.json({ error: `File tidak dapat dibaca: ${message}` }, { status: 400 });
  }

  const validation = validateImportData(data);
  const plan = await analyzeImportData(validation.data);

  const totalRows =
    validation.data.anggota.length +
    validation.data.relasi.length +
    validation.data.akun.length;

  const reportJson = {
    filename: file.name,
    data: validation.data,
    errors: validation.errors,
    warnings: validation.warnings,
    credentials: plan.credentials,
    counts: plan.counts,
  };

  const batch = await prisma.importBatch.create({
    data: {
      filename: file.name,
      status: "VALIDATED",
      totalRows,
      successRows: 0,
      errorRows: validation.errors.length,
      reportJson,
      createdById: guard.user.id,
    },
  });

  await logAudit({
    action: "IMPORT_VALIDATE",
    entityType: "ImportBatch",
    entityId: batch.id,
    afterData: { filename: file.name, totalRows, errors: validation.errors.length },
    actorUserId: guard.user.id,
  });

  return NextResponse.json({
    batchId: batch.id,
    filename: file.name,
    valid: validation.valid,
    totalRows,
    errors: validation.errors,
    warnings: validation.warnings,
    counts: plan.counts,
    credentials: plan.credentials,
    preview: {
      anggota: validation.data.anggota.slice(0, 100),
      relasi: validation.data.relasi.slice(0, 100),
      akun: validation.data.akun.slice(0, 100),
    },
  });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireImportAdmin } from "@/lib/import/auth";
import { MAX_IMPORT_BYTES } from "@/lib/import/types";
import { parseRegistrasiXLSX, parseRegistrasiCSV } from "@/lib/registrasi-import/parser";
import { validateRegistrasiImport } from "@/lib/registrasi-import/validate";
import { analyzeRegistrasiImport } from "@/lib/registrasi-import/analyze";
import { REGISTRASI_IMPORT_TYPE } from "@/lib/registrasi-import/types";
import { buildRegistrasiPreview } from "@/lib/registrasi-import/preview";
import { REUNI_2027_SLUG } from "@/lib/registrasi";

/**
 * GET /api/admin/registrasi — daftar batch impor registrasi terakhir.
 */
export async function GET() {
  const guard = await requireImportAdmin();
  if ("error" in guard) return guard.error;

  const batches = await prisma.importBatch.findMany({
    where: { type: REGISTRASI_IMPORT_TYPE },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { createdBy: { select: { person: { select: { fullName: true } } } } },
  });

  return NextResponse.json({
    batches: batches.map((b) => ({
      id: b.id,
      filename: b.filename,
      status: b.status,
      totalRows: b.totalRows,
      successRows: b.successRows,
      errorRows: b.errorRows,
      createdAt: b.createdAt.toISOString(),
      createdBy: b.createdBy.person.fullName,
    })),
  });
}

/**
 * POST /api/admin/registrasi — unggah + validasi + simpan batch (belum commit).
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
    data = isCsv ? parseRegistrasiCSV(buffer) : await parseRegistrasiXLSX(buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal membaca file";
    return NextResponse.json({ error: `File tidak dapat dibaca: ${message}` }, { status: 400 });
  }

  const validation = await validateRegistrasiImport(prisma, data);

  // Event reuni tujuan; bila tidak ada, anggota tetap tercatat tanpa peserta reuni.
  const reunion = await prisma.reunion.findUnique({
    where: { slug: REUNI_2027_SLUG },
    select: { id: true },
  });
  const reunionId = reunion?.id ?? null;

  const plan = await analyzeRegistrasiImport(prisma, validation.data, reunionId);

  const totalRows = validation.data.rows.length;
  // Pratinjau digabung dengan rencana kredensial lewat fungsi bersama, sehingga
  // baris ber-error tidak menggeser kolom username/status baris berikutnya.
  const previewRows = buildRegistrasiPreview(validation.data.rows, plan.credentials);

  const reportJson = {
    filename: file.name,
    data: validation.data,
    errors: validation.errors,
    warnings: validation.warnings,
    credentials: plan.credentials,
    skipped: plan.skipped,
    counts: plan.counts,
    plannedUsernames: plan.plannedUsernames,
    reunionId,
  };

  const batch = await prisma.importBatch.create({
    data: {
      type: REGISTRASI_IMPORT_TYPE,
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
    action: "REGISTRASI_IMPORT_VALIDATE",
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
    skipped: plan.skipped,
    preview: { rows: previewRows },
  });
}

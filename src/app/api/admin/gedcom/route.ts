import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireImportAdmin } from "@/lib/import/auth";
import { parseGedcom } from "@/lib/gedcom/parser";
import { validateGedcom } from "@/lib/gedcom/validate";
import { analyzeGedcom } from "@/lib/gedcom/analyze";
import { buildGedcomPreview } from "@/lib/gedcom/preview";
import {
  GEDCOM_IMPORT_TYPE,
  MAX_GEDCOM_BYTES,
} from "@/lib/gedcom/types";

/**
 * GET /api/admin/gedcom — daftar batch impor GEDCOM terakhir.
 */
export async function GET() {
  const guard = await requireImportAdmin();
  if ("error" in guard) return guard.error;

  const batches = await prisma.importBatch.findMany({
    where: { type: GEDCOM_IMPORT_TYPE },
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
 * POST /api/admin/gedcom — unggah + validasi + rencana + simpan batch GEDCOM.
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

  if (file.size > MAX_GEDCOM_BYTES) {
    return NextResponse.json({ error: "Ukuran file maksimal 10MB" }, { status: 400 });
  }

  const name = file.name.toLowerCase();
  const isGedcom = name.endsWith(".ged") || name.endsWith(".gedcom") || file.type === "text/plain";
  if (!isGedcom) {
    return NextResponse.json(
      { error: "Format harus .ged atau .gedcom." },
      { status: 400 },
    );
  }

  let data;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    data = parseGedcom(buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal membaca file";
    return NextResponse.json(
      { error: `File GEDCOM tidak dapat dibaca: ${message}` },
      { status: 400 },
    );
  }

  const validation = validateGedcom(data);
  const plan = await analyzeGedcom(prisma, data, validation);

  const totalRows = data.persons.length;
  const reportJson = {
    filename: file.name,
    charSet: data.charSet,
    data,
    errors: validation.errors,
    warnings: validation.warnings,
    counts: {
      total: totalRows,
      personsCreated: plan.personsCreated,
      personsSkipped: plan.personsSkipped,
      childEdgesCreated: plan.childEdgesCreated,
      partnerEdgesCreated: plan.partnerEdgesCreated,
    },
    // Snapshot rencana disimpan agar halaman pratinjau bisa menampilkan
    // ringkasan analisis tanpa menghitung ulang (dan agar rollback punya acuan
    // orang mana yang direncanakan dibuat).
    planPersons: plan.persons,
  };

  const batch = await prisma.importBatch.create({
    data: {
      filename: file.name,
      type: GEDCOM_IMPORT_TYPE,
      status: "VALIDATED",
      totalRows,
      successRows: 0,
      errorRows: validation.errors.length,
      reportJson,
      createdById: guard.user.id,
    },
  });

  await logAudit({
    action: "GEDCOM_IMPORT_VALIDATE",
    entityType: "ImportBatch",
    entityId: batch.id,
    afterData: { filename: file.name, totalRows, errors: validation.errors.length },
    actorUserId: guard.user.id,
  });

  const preview = buildGedcomPreview(data, plan, 100);

  return NextResponse.json({
    batchId: batch.id,
    filename: file.name,
    valid: validation.valid,
    totalRows,
    errors: validation.errors,
    warnings: validation.warnings,
    counts: reportJson.counts,
    preview,
  });
}
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateCredentialCSV, generateErrorCSV } from "@/lib/import/report";
import { requireImportAdmin } from "@/lib/import/auth";
import type { ImportBatchPayload } from "@/lib/import/types";
import { DEFAULT_IMPORT_PASSWORD } from "@/lib/import/types";

/**
 * GET /api/admin/impor/laporan?id=<batchId>&format=<json|credentials|errors>
 */
export async function GET(request: Request) {
  const guard = await requireImportAdmin();
  if ("error" in guard) return guard.error;

  const url = new URL(request.url);
  const batchId = url.searchParams.get("id");
  const format = url.searchParams.get("format") ?? "json";

  if (!batchId) {
    return NextResponse.json({ error: "Parameter id diperlukan" }, { status: 400 });
  }

  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      filename: true,
      status: true,
      totalRows: true,
      successRows: true,
      errorRows: true,
      reportJson: true,
      createdAt: true,
    },
  });

  if (!batch) {
    return NextResponse.json({ error: "Batch tidak ditemukan" }, { status: 404 });
  }

  const payload = batch.reportJson as ImportBatchPayload | null;

  if (format === "json") {
    return NextResponse.json({
      id: batch.id,
      filename: batch.filename,
      status: batch.status,
      totalRows: batch.totalRows,
      successRows: batch.successRows,
      errorRows: batch.errorRows,
      createdAt: batch.createdAt,
      errors: payload?.errors ?? [],
      warnings: payload?.warnings ?? [],
      counts: payload?.counts ?? null,
      credentials: payload?.credentials ?? [],
    }, { headers: { "Cache-Control": "private, no-store" } });
  }

  if (format === "credentials") {
    if (batch.status !== "COMMITTED") {
      return NextResponse.json({ error: "Kredensial hanya tersedia setelah impor berhasil disimpan." }, { status: 409 });
    }
    if (!payload?.credentials || payload.credentials.length === 0) {
      return NextResponse.json({ error: "Tidak ada kredensial untuk diunduh" }, { status: 404 });
    }
    const csv = generateCredentialCSV(payload.credentials, DEFAULT_IMPORT_PASSWORD);
    return new NextResponse(new Uint8Array(csv), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": `attachment; filename="kredensial-${batch.id}.csv"`,
      },
    });
  }

  if (format === "errors") {
    if (!payload?.errors || payload.errors.length === 0) {
      return NextResponse.json({ error: "Tidak ada error untuk diunduh" }, { status: 404 });
    }
    const csv = generateErrorCSV(payload.errors);
    return new NextResponse(new Uint8Array(csv), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": `attachment; filename="error-${batch.id}.csv"`,
      },
    });
  }

  return NextResponse.json({ error: "Format tidak dikenal" }, { status: 400 });
}

import { NextResponse } from "next/server";
import { requireImportAdmin } from "@/lib/import/auth";
import { commitRegistrasiImport, RegistrasiImportError } from "@/lib/registrasi-import/commit";

/**
 * POST /api/admin/registrasi/commit — commit batch yang sudah divalidasi.
 * Batch dikunci di dalam transaksi sehingga klik ganda tidak menggandakan data.
 */
export async function POST(request: Request) {
  const guard = await requireImportAdmin();
  if ("error" in guard) return guard.error;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const batchId = body && typeof body === "object" ? body.batchId : undefined;
  if (typeof batchId !== "string" || !batchId.trim() || batchId.length > 100) {
    return NextResponse.json({ error: "batchId diperlukan" }, { status: 400 });
  }

  try {
    const result = await commitRegistrasiImport(batchId, guard.user.id);
    return NextResponse.json({
      success: true,
      batchId,
      counts: result.counts,
      credentials: result.credentials,
      skipped: result.skipped,
    });
  } catch (error) {
    if (error instanceof RegistrasiImportError) {
      return NextResponse.json({ error: error.message, errors: error.errors }, { status: error.status });
    }
    throw error;
  }
}

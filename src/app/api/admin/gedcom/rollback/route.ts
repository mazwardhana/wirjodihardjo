import { NextResponse } from "next/server";
import { requireImportAdmin } from "@/lib/import/auth";
import { rollbackGedcomImport } from "@/lib/gedcom/rollback";
import { GedcomImportError } from "@/lib/gedcom/commit";

/**
 * POST /api/admin/gedcom/rollback — batalkan hasil commit batch GEDCOM.
 * Body: { batchId }. Hanya untuk batch yang sudah COMMITTED dan belum pernah
 * dibatalkan. Menghapus efek commit dalam satu transaksi serializable.
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
    const result = await rollbackGedcomImport(batchId, guard.user.id);
    return NextResponse.json({ success: true, batchId, ...result });
  } catch (error) {
    if (error instanceof GedcomImportError) {
      return NextResponse.json(
        { error: error.message, errors: error.errors },
        { status: error.status },
      );
    }
    throw error;
  }
}

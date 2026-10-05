import { NextResponse } from "next/server";
import { requireImportAdmin } from "@/lib/import/auth";
import {
  generateRegistrasiTemplateXLSX,
  generateRegistrasiTemplateCSV,
} from "@/lib/registrasi-import/template";

/**
 * GET /api/admin/registrasi/template?format=xlsx|csv
 */
export async function GET(request: Request) {
  const guard = await requireImportAdmin();
  if ("error" in guard) return guard.error;

  const format = new URL(request.url).searchParams.get("format") ?? "xlsx";

  if (format === "csv") {
    const csv = generateRegistrasiTemplateCSV();
    return new NextResponse(new Uint8Array(csv), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": 'attachment; filename="template-impor-registrasi.csv"',
      },
    });
  }

  if (format === "xlsx") {
    const xlsx = await generateRegistrasiTemplateXLSX();
    return new NextResponse(new Uint8Array(xlsx), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": 'attachment; filename="template-impor-registrasi.xlsx"',
      },
    });
  }

  return NextResponse.json({ error: "Format tidak dikenal" }, { status: 400 });
}

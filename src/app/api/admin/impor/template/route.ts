import { NextResponse } from "next/server";
import { generateTemplateXLSX, generateTemplateCSV } from "@/lib/import/template";
import { requireImportAdmin } from "@/lib/import/auth";

export async function GET(request: Request) {
  const guard = await requireImportAdmin();
  if ("error" in guard) return guard.error;
  const sheet = new URL(request.url).searchParams.get("sheet");
  if (sheet !== null && !["Anggota", "Relasi", "Akun"].includes(sheet)) {
    return NextResponse.json({ error: "Sheet template tidak dikenal." }, { status: 400 });
  }
  const csvSheet = sheet as "Anggota" | "Relasi" | "Akun" | null;
  const buffer = csvSheet ? generateTemplateCSV(csvSheet) : await generateTemplateXLSX();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": csvSheet ? "text/csv; charset=utf-8" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="template-impor-${csvSheet?.toLowerCase() ?? "wirjodihardjo"}.${csvSheet ? "csv" : "xlsx"}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

import { NextResponse } from "next/server";
import { generateTemplateXLSX, generateTemplateCSV } from "@/lib/import/template";
import { requireImportAdmin } from "@/lib/import/auth";

export async function GET(request: Request) {
  const guard = await requireImportAdmin();
  if ("error" in guard) return guard.error;
  const buffer = await generateTemplateXLSX();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="template-impor-wirjodihardjo.xlsx"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

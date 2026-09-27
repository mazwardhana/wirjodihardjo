import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getActorScope, AuthorizationError } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { parseUserImportCsv, UserImportParseError } from "@/lib/user-import/parser";
import { validateUserImport } from "@/lib/user-import/validator";
import { importUsers } from "@/lib/user-import/importer";

const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

/**
 * POST /api/admin/pengguna/import-bulk
 *
 * Bulk user import with temporary credentials. SUPER_ADMIN only.
 * Supports multipart/form-data (file + action) or JSON (csv + action).
 * Actions: "preview" (default) or "commit".
 */
export async function POST(request: Request) {
  // ─── Authorization ──────────────────────────────────────────────────────────
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  try {
    const scope = await getActorScope(session.user.id);
    if (scope.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Hanya Super Admin" }, { status: 403 });
    }
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  // ─── Parse request ──────────────────────────────────────────────────────────
  const contentType = request.headers.get("content-type") || "";
  let csv: string;
  let action: string;
  let filename: string | null = null;

  if (contentType.includes("multipart/form-data")) {
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
    if (!name.endsWith(".csv")) {
      return NextResponse.json({ error: "Format harus CSV" }, { status: 400 });
    }

    csv = await file.text();
    filename = file.name;
    action = (formData.get("action") as string) || "preview";
  } else {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
    }

    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
    }

    const b = body as Record<string, unknown>;
    if (typeof b.csv !== "string" || !b.csv.trim()) {
      return NextResponse.json({ error: "Field csv wajib diisi" }, { status: 400 });
    }

    csv = b.csv;
    action = typeof b.action === "string" ? b.action : "preview";
  }

  if (action !== "preview" && action !== "commit") {
    return NextResponse.json({ error: "Action harus 'preview' atau 'commit'" }, { status: 400 });
  }

  // ─── Parse CSV ──────────────────────────────────────────────────────────────
  let rows;
  try {
    rows = parseUserImportCsv(csv);
  } catch (error) {
    if (error instanceof UserImportParseError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Gagal membaca CSV";
    return NextResponse.json({ error: `File tidak dapat dibaca: ${message}` }, { status: 400 });
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "File impor kosong: tidak ada baris data." },
      { status: 400 },
    );
  }

  // ─── Validate ───────────────────────────────────────────────────────────────
  const validation = await validateUserImport(rows);

  // ─── Preview ────────────────────────────────────────────────────────────────
  if (action === "preview") {
    return NextResponse.json({
      valid: validation.valid,
      totalRows: rows.length,
      matched: validation.matched.map(({ password, ...rest }) => rest),
      conflicts: validation.conflicts,
      errors: validation.errors,
    });
  }

  // ─── Commit ─────────────────────────────────────────────────────────────────
  if (!validation.valid) {
    return NextResponse.json(
      {
        error: "Validasi data gagal",
        errors: validation.errors,
      },
      { status: 400 },
    );
  }

  try {
    const result = await importUsers(validation.matched, {
      createdById: session.user.id,
    });

    await logAudit({
      action: "USER_IMPORT_BULK",
      entityType: "User",
      afterData: { created: result.created, usernames: result.users.map((u) => u.username) } as any,
      actorUserId: session.user.id,
    });

    return NextResponse.json(
      {
        ok: true,
        created: result.created,
        users: result.users,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal membuat user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

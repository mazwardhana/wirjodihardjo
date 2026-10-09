import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";
import { checkIn, MAX_ROWS_PER_GROUP, type CheckInRowInput } from "@/lib/buku-tamu";
import { REUNI_2027_SLUG, EXCLUDED_BRANCH_SLUG } from "@/lib/registrasi";

const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;
type Gender = (typeof GENDERS)[number];

/** IP pemanggil dari header proxy, dengan fallback agar kunci selalu terisi. */
function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function isGender(value: unknown): value is Gender {
  return typeof value === "string" && (GENDERS as readonly string[]).includes(value);
}

/**
 * Menormalkan satu baris kiriman menjadi bentuk yang dipahami modul buku tamu.
 * Kembalikan null bila bentuknya tidak dikenali.
 */
function parseRow(raw: unknown): CheckInRowInput | null {
  if (typeof raw !== "object" || raw === null) return null;
  const row = raw as Record<string, unknown>;

  if (typeof row.personId === "string" && row.personId.trim() !== "") {
    return { personId: row.personId };
  }

  const fullName = typeof row.fullName === "string" ? row.fullName.trim() : "";
  const namaPanggilan = typeof row.namaPanggilan === "string" ? row.namaPanggilan.trim() : "";
  if (fullName !== "" && typeof row.namaPanggilan === "string" && isGender(row.gender)) {
    return { fullName, namaPanggilan, gender: row.gender };
  }

  return null;
}

// Absen publik: siapa pun yang memindai QR boleh menandai kehadiran tanpa
// login. Karena itu dibatasi lajunya dan cabang divalidasi ketat.
export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!consumeRateLimit("buku-tamu:" + ip, 10, 60_000)) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan. Coba lagi sebentar." },
      { status: 429 },
    );
  }

  let body: { branchId?: unknown; rows?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  const branchId = typeof body.branchId === "string" ? body.branchId.trim() : "";
  if (!branchId) {
    return NextResponse.json(
      { error: "Pilih keluarga besar terlebih dahulu." },
      { status: 400 },
    );
  }

  if (!Array.isArray(body.rows) || body.rows.length < 1) {
    return NextResponse.json({ error: "Belum ada anggota yang diisi." }, { status: 400 });
  }
  if (body.rows.length > MAX_ROWS_PER_GROUP) {
    return NextResponse.json(
      { error: `Maksimal ${MAX_ROWS_PER_GROUP} orang per kiriman.` },
      { status: 400 },
    );
  }

  const rows: CheckInRowInput[] = [];
  for (const raw of body.rows) {
    const parsed = parseRow(raw);
    if (!parsed) {
      return NextResponse.json(
        { error: "Ada isian yang tidak dikenali." },
        { status: 400 },
      );
    }
    rows.push(parsed);
  }

  // Cabang harus ada, aktif, dan bukan cabang yang sengaja disembunyikan.
  const branch = (await prisma.branch.findUnique({
    where: { id: branchId },
    select: { id: true, slug: true, isActive: true },
  })) as { id: string; slug: string; isActive: boolean } | null;

  if (!branch || !branch.isActive || branch.slug === EXCLUDED_BRANCH_SLUG) {
    return NextResponse.json(
      { error: "Keluarga besar yang dipilih tidak tersedia." },
      { status: 400 },
    );
  }

  // Reuni mungkin belum dibuat. Bila belum ada, anggota tetap diproses tanpa
  // pendaftaran reuni (reunionId kosong).
  const reunion = await prisma.reunion.findUnique({
    where: { slug: REUNI_2027_SLUG },
    select: { id: true },
  });

  try {
    const result = await checkIn(prisma, {
      reunionId: reunion?.id ?? "",
      branchId,
      rows,
      source: "QR_SELF",
      actorUserId: null,
    });
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "TOO_MANY_ROWS") {
      return NextResponse.json(
        { error: `Maksimal ${MAX_ROWS_PER_GROUP} orang per kiriman.` },
        { status: 400 },
      );
    }
    console.error("Gagal menyimpan buku tamu:", error);
    return NextResponse.json(
      { error: "Absen gagal disimpan. Silakan coba beberapa saat lagi." },
      { status: 500 },
    );
  }
}

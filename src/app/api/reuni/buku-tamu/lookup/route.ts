import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";
import { lookupCandidates, MIN_QUERY_LENGTH } from "@/lib/buku-tamu";
import { REUNI_2027_SLUG } from "@/lib/registrasi";

/** IP pemanggil dari header proxy, dengan fallback agar kunci selalu terisi. */
function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

// Pencarian publik: siapa pun boleh memakai, tanpa login. Karena itu dibatasi
// lajunya dan hanya mengembalikan field non-sensitif lewat lookupCandidates.
export async function GET(request: Request) {
  const ip = clientIp(request);
  if (!consumeRateLimit("lookup:" + ip, 30, 60_000)) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan. Coba lagi sebentar." },
      { status: 429 },
    );
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const branchId = (url.searchParams.get("branchId") ?? "").trim();

  if (q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ error: "Ketik minimal 2 huruf." }, { status: 400 });
  }
  if (!branchId) {
    return NextResponse.json(
      { error: "Pilih keluarga besar terlebih dahulu." },
      { status: 400 },
    );
  }

  // Reuni harus ada agar status terdaftar/absen bisa dihitung. Bila belum ada,
  // pencarian tetap mungkin berguna untuk telusur nama, jadi kembalikan rows
  // dengan alreadyRegistered/checkedIn false semua (reunionId kosong).
  const reunion = await prisma.reunion.findUnique({
    where: { slug: REUNI_2027_SLUG },
    select: { id: true },
  });

  try {
    const rows = await lookupCandidates(prisma, {
      reunionId: reunion?.id ?? "",
      branchId,
      q,
    });
    return NextResponse.json({ rows });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "QUERY_TOO_SHORT" || error.message === "BRANCH_ID_REQUIRED")
    ) {
      return NextResponse.json({ error: "Ketik minimal 2 huruf." }, { status: 400 });
    }
    console.error("Gagal mencari kandidat buku tamu:", error);
    return NextResponse.json(
      { error: "Pencarian gagal. Silakan coba beberapa saat lagi." },
      { status: 500 },
    );
  }
}

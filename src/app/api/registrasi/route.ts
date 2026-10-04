import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createRegistrations,
  validateRegistration,
  REUNI_2027_SLUG,
  type RegistrationRowInput,
} from "@/lib/registrasi";

// Formulir publik: siapa pun boleh mengisi, tanpa login.
export async function POST(request: Request) {
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

  if (!Array.isArray(body.rows)) {
    return NextResponse.json(
      { error: "Belum ada anggota yang diisi." },
      { status: 400 },
    );
  }

  const validation = validateRegistration(body.rows as RegistrationRowInput[]);
  if (!validation.valid) {
    const first = validation.errors[0];
    return NextResponse.json(
      {
        error: first.field === "rows" ? first.message : "Periksa kembali isian yang ditandai.",
        errors: validation.errors,
      },
      { status: 400 },
    );
  }

  // Event reuni tujuan pendaftaran. Bila belum ada, anggota tetap tercatat
  // tanpa pendaftaran reuni — halaman statistik akan menandainya sebagai belum terdaftar.
  const reunion = await prisma.reunion.findUnique({
    where: { slug: REUNI_2027_SLUG },
    select: { id: true },
  });

  try {
    const result = await createRegistrations(prisma, {
      branchId,
      rows: validation.rows,
      reunionId: reunion?.id ?? null,
      submitterIp: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });

    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "BRANCH_INVALID") {
      return NextResponse.json(
        { error: "Keluarga besar yang dipilih tidak tersedia." },
        { status: 400 },
      );
    }
    console.error("Gagal menyimpan registrasi keluarga:", error);
    return NextResponse.json(
      { error: "Registrasi gagal disimpan. Silakan coba beberapa saat lagi." },
      { status: 500 },
    );
  }
}
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { assertPersonAccess, requireAdminScope, AuthorizationError } from "@/lib/rbac";

const editSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Nama lengkap wajib diisi")
    .max(200, "Nama lengkap maksimal 200 karakter"),
  nickname: z.string().trim().max(100, "Nama panggilan maksimal 100 karakter").nullish(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"], "Jenis kelamin tidak valid"),
  birthPlace: z.string().trim().max(200, "Tempat lahir maksimal 200 karakter").nullish(),
  birthDate: z.string().trim().nullish(),
  phone: z.string().trim().max(40, "Nomor telepon maksimal 40 karakter").nullish(),
  addressLine: z.string().trim().max(300, "Alamat domisili maksimal 300 karakter").nullish(),
  city: z.string().trim().max(120, "Kota domisili maksimal 120 karakter").nullish(),
});

function parseBirthDate(value: string | null | undefined): Date | null | undefined {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed = editSchema.safeParse(body);
    if (!parsed.success) {
      const issues = parsed.error.flatten().fieldErrors;
      const firstMessage = Object.values(issues).flat()[0] ?? "Data tidak valid";
      return NextResponse.json({ error: firstMessage, issues }, { status: 400 });
    }

    const birthDate = parseBirthDate(parsed.data.birthDate);
    if (birthDate === undefined) {
      return NextResponse.json({ error: "Tanggal lahir tidak valid" }, { status: 400 });
    }

    const scope = await requireAdminScope(session.user.id);
    await assertPersonAccess(scope, id);

    const existing = await prisma.person.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        nickname: true,
        gender: true,
        birthDate: true,
        birthPlace: true,
        branchId: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Anggota tidak ditemukan" }, { status: 404 });
    }

    const data = parsed.data;
    const person = await prisma.person.update({
      where: { id },
      data: {
        fullName: data.fullName,
        nickname: data.nickname?.trim() || null,
        gender: data.gender,
        birthPlace: data.birthPlace?.trim() || null,
        birthDate,
      },
    });

    await prisma.personPrivate.upsert({
      where: { personId: id },
      create: {
        personId: id,
        city: data.city?.trim() || null,
        phone: data.phone?.trim() || null,
        addressLine: data.addressLine?.trim() || null,
      },
      update: {
        city: data.city?.trim() || null,
        phone: data.phone?.trim() || null,
        addressLine: data.addressLine?.trim() || null,
      },
    });

    await logAudit({
      action: "PERSON_UPDATE",
      entityType: "Person",
      entityId: id,
      beforeData: existing as never,
      afterData: data as never,
      actorUserId: session.user.id,
    });

    return NextResponse.json(person);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

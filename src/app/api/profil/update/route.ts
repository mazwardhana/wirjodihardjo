import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const isoDate = z
  .string()
  .trim()
  .refine((value) => value === "" || !Number.isNaN(new Date(value).getTime()), {
    message: "Tanggal tidak valid",
  });

const schema = z.object({
  personId: z.string().max(100).optional(),
  fullName: z.string().min(1).max(200).optional(),
  nickname: z.string().max(100).optional(),
  namaPanggilan: z.string().max(100).optional(),
  bio: z.string().max(2000).optional(),
  occupation: z.string().max(200).optional(),
  status: z.string().max(500).optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  birthPlace: z.string().max(200).optional(),
  birthDate: isoDate.optional(),
  birthDatePrecision: z.enum(["DAY", "MONTH", "YEAR"]).optional(),
  isDeceased: z.boolean().optional(),
  deathPlace: z.string().max(200).optional(),
  deathDate: isoDate.optional(),
  phone: z.string().max(40).optional(),
  whatsapp: z.string().max(40).optional(),
  addressLine: z.string().max(300).optional(),
  city: z.string().max(100).optional(),
  province: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  visibleToMembers: z.boolean().optional(),
});

// String nullable: input kosong berarti dihapus (null), bukan string kosong.
function nullable(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  return value === "" ? null : value;
}

// "" berarti mengosongkan tanggal; nilai lain harus tanggal valid (sudah divalidasi zod).
function toDate(value: string | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === "") return null;
  return new Date(value);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const data = parsed.data;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { personId: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 });
  }

  if (data.personId && data.personId !== user.personId) {
    return NextResponse.json(
      { error: "Anda hanya dapat mengubah profil sendiri" },
      { status: 403 },
    );
  }

  // Field publik
  await prisma.person.update({
    where: { id: user.personId },
    data: {
      ...(data.fullName !== undefined && { fullName: data.fullName }),
      ...(data.nickname !== undefined && { nickname: nullable(data.nickname) }),
      ...(data.namaPanggilan !== undefined && { namaPanggilan: nullable(data.namaPanggilan) }),
      ...(data.bio !== undefined && { bio: nullable(data.bio) }),
      ...(data.occupation !== undefined && { occupation: nullable(data.occupation) }),
      ...(data.status !== undefined && { status: nullable(data.status) }),
      ...(data.gender !== undefined && { gender: data.gender }),
      ...(data.birthPlace !== undefined && { birthPlace: nullable(data.birthPlace) }),
      ...(data.birthDatePrecision !== undefined && {
        birthDatePrecision: data.birthDatePrecision,
      }),
      ...(data.isDeceased !== undefined && { isDeceased: data.isDeceased }),
      ...(data.deathPlace !== undefined && { deathPlace: nullable(data.deathPlace) }),
      ...(data.birthDate !== undefined && { birthDate: toDate(data.birthDate) }),
      ...(data.deathDate !== undefined && { deathDate: toDate(data.deathDate) }),
    },
  });

  // Field privat
  await prisma.personPrivate.upsert({
    where: { personId: user.personId },
    update: {
      ...(data.phone !== undefined && { phone: nullable(data.phone) }),
      ...(data.whatsapp !== undefined && { whatsapp: nullable(data.whatsapp) }),
      ...(data.addressLine !== undefined && { addressLine: nullable(data.addressLine) }),
      ...(data.city !== undefined && { city: nullable(data.city) }),
      ...(data.province !== undefined && { province: nullable(data.province) }),
      ...(data.postalCode !== undefined && { postalCode: nullable(data.postalCode) }),
      ...(data.visibleToMembers !== undefined && {
        visibleToMembers: data.visibleToMembers,
      }),
    },
    create: {
      personId: user.personId,
      phone: nullable(data.phone) ?? null,
      whatsapp: nullable(data.whatsapp) ?? null,
      addressLine: nullable(data.addressLine) ?? null,
      city: nullable(data.city) ?? null,
      province: nullable(data.province) ?? null,
      postalCode: nullable(data.postalCode) ?? null,
      visibleToMembers: data.visibleToMembers ?? true,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "UPDATE_PROFILE",
      entityType: "Person",
      entityId: user.personId,
      actorUserId: session.user.id,
    },
  });

  return NextResponse.json({ ok: true });
}

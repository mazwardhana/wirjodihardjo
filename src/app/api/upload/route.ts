import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UPLOAD_DIR, UPLOAD_URL_PREFIX, MAX_UPLOAD_BYTES } from "@/lib/upload";

const ALLOWED: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

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

  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Format harus JPG, PNG, atau WebP" },
      { status: 400 },
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Ukuran maksimal 5MB" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  await mkdir(UPLOAD_DIR, { recursive: true });

  const filename = `${randomUUID()}${ext}`;
  await writeFile(
    join(/* turbopackIgnore: true */ UPLOAD_DIR, filename),
    bytes,
  );

  const url = `${UPLOAD_URL_PREFIX}/${filename}`;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { personId: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 });
  }

  await prisma.person.update({
    where: { id: user.personId },
    data: { photoUrl: url },
  });

  await prisma.auditLog.create({
    data: {
      action: "UPLOAD_PROFILE_PHOTO",
      entityType: "Person",
      entityId: user.personId,
      afterData: { photoUrl: url },
      actorUserId: session.user.id,
    },
  });

  return NextResponse.json({ url });
}

/** Hapus foto profil. */
export async function DELETE() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { personId: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 });
  }

  await prisma.person.update({
    where: { id: user.personId },
    data: { photoUrl: null },
  });

  await prisma.auditLog.create({
    data: {
      action: "REMOVE_PROFILE_PHOTO",
      entityType: "Person",
      entityId: user.personId,
      actorUserId: session.user.id,
    },
  });

  return NextResponse.json({ ok: true });
}
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { notifyAdminsOfNewSubmission } from "@/lib/notifications";
import {
  addChildSchema,
  addSpouseSchema,
  editPersonSchema,
  editRelationSchema,
} from "@/server/validations";
const schemaByType = {
  ADD_CHILD: addChildSchema,
  ADD_SPOUSE: addSpouseSchema,
  EDIT_PERSON: editPersonSchema,
  EDIT_RELATION: editRelationSchema,
} as const;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const { type } = body as { type?: string };
  if (!type || !(type in schemaByType)) {
    return NextResponse.json({ error: "Tipe pengajuan tidak valid" }, { status: 400 });
  }

  const schema = schemaByType[type as keyof typeof schemaByType];
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Data tidak valid", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // Verifikasi relasi target: pengaju hanya boleh mengajukan untuk dirinya sendiri
  // atau untuk anggota yang ada di pohon (admin yang menyetujui yang memutuskan).
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, personId: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 });
  }

  const payload = parsed.data as Record<string, unknown>;

  // targetPersonId = orang yang jadi relasi utama (mis. parentId untuk ADD_CHILD)
  const targetPersonId =
    (payload.personId as string | undefined) ??
    (payload.parentId as string | undefined) ??
    null;

  if (targetPersonId) {
    const target = await prisma.person.findUnique({
      where: { id: targetPersonId },
      select: { id: true },
    });
    if (!target) {
      return NextResponse.json({ error: "Anggota target tidak ditemukan" }, { status: 404 });
    }
  }

  const submission = await prisma.submission.create({
    data: {
      type: type as any,
      payload: payload as any,
      status: "PENDING",
      submittedByUserId: user.id,
      targetPersonId,
    },
  });

  await logAudit({
    action: "SUBMISSION_CREATE",
    entityType: "Submission",
    entityId: submission.id,
    afterData: payload as any,
    actorUserId: user.id,
  });

  await notifyAdminsOfNewSubmission(submission.id, type);

  return NextResponse.json({ id: submission.id, status: "PENDING" }, { status: 201 });
}

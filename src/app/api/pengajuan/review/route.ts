import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { notifySubmissionStatus } from "@/lib/notifications";
import { recalculateGenerationLevel } from "@/lib/genealogy";

/** Cek duplikasi sebelum menyetujui. */
async function cekDuplikasi(payload: Record<string, unknown>, type: string): Promise<string | null> {
  switch (type) {
    case "ADD_CHILD": {
      const pid = payload.parentId as string;
      const name = payload.fullName as string;
      if (pid && name) {
        const dup = await prisma.person.findFirst({
          where: {
            fullName: { equals: name, mode: "insensitive" },
            parents: { some: { parentId: pid } },
          },
          select: { id: true },
        });
        if (dup) return `Anggota dengan nama "${name}" sudah tercatat sebagai anak dari orang tua yang sama.`;
      }
      break;
    }
    case "ADD_SPOUSE": {
      const pid = payload.personId as string;
      const name = payload.fullName as string;
      if (pid && name) {
        const dup = await prisma.person.findFirst({
          where: {
            fullName: { equals: name, mode: "insensitive" },
            OR: [
              { partnershipsA: { some: { partnerB: { fullName: { equals: name, mode: "insensitive" } } } } },
              { partnershipsB: { some: { partnerA: { fullName: { equals: name, mode: "insensitive" } } } } },
            ],
          },
          select: { id: true },
        });
        if (dup) return `Pasangan dengan nama "${name}" sudah tercatat.`;
      }
      break;
    }
    case "ADD_PERSON": {
      const name = payload.fullName as string;
      if (name) {
        const dup = await prisma.person.findFirst({
          where: { fullName: { equals: name, mode: "insensitive" } },
          select: { id: true },
        });
        if (dup) return `Anggota dengan nama "${name}" sudah ada.`;
      }
      break;
    }
  }
  return null;
}

/**
 * Setujui/tolak pengajuan oleh admin.
 * APPROVE: terapkan payload ke DB, lalu ubah status.
 * REJECT: tulis reviewNote, ubah status.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, branchAdminOf: { select: { id: true } } },
  });
  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "BRANCH_ADMIN")) {
    return NextResponse.json({ error: "Hanya admin" }, { status: 403 });
  }

  let body: { id: string; action: "APPROVE" | "REJECT"; reviewNote?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const submission = await prisma.submission.findUnique({
    where: { id: body.id },
    include: {
      targetPerson: { select: { id: true, branchId: true } },
      submitter: { select: { id: true } },
    },
  });
  if (!submission || submission.status !== "PENDING") {
    return NextResponse.json({ error: "Pengajuan tidak ditemukan atau sudah diproses" }, { status: 404 });
  }

  // Branch admin hanya untuk cabangnya sendiri
  if (user.role === "BRANCH_ADMIN" && user.branchAdminOf?.id) {
    if (submission.targetPerson?.branchId !== user.branchAdminOf.id) {
      return NextResponse.json({ error: "Di luar cabang Anda" }, { status: 403 });
    }
  }

  if (body.action === "REJECT") {
    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: "REJECTED",
        reviewNote: body.reviewNote ?? null,
        reviewedByUserId: user.id,
        reviewedAt: new Date(),
      },
    });
    await notifySubmissionStatus(submission.id, "REJECTED", body.reviewNote);
    await logAudit({
      action: "SUBMISSION_REJECT",
      entityType: "Submission",
      entityId: submission.id,
      actorUserId: user.id,
    });
    return NextResponse.json({ status: "REJECTED" });
  }

  // APPROVE — tolak duplikasi sebelum menulis apa pun
  const payload = submission.payload as Record<string, unknown>;
  const duplikat = await cekDuplikasi(payload, submission.type);
  if (duplikat) {
    return NextResponse.json({ error: duplikat }, { status: 409 });
  }

  let beforeSnapshot: unknown = null;
  if (submission.type === "EDIT_PERSON" && submission.targetPerson?.id) {
    beforeSnapshot = await prisma.person.findUnique({
      where: { id: submission.targetPerson.id },
    });
  }

  let appliedPersonId: string | null = null;

  try {
    appliedPersonId = await applySubmission(payload, submission.type, submission.targetPerson?.id);
  } catch (e) {
    return NextResponse.json({ error: `Gagal menerapkan: ${(e as Error).message}` }, { status: 500 });
  }

  await prisma.submission.update({
    where: { id: submission.id },
    data: {
      status: "APPROVED",
      appliedPersonId,
      reviewedByUserId: user.id,
      reviewedAt: new Date(),
    },
  });

  // Rekalkulasi generasi
  if (appliedPersonId) {
    try {
      await recalculateGenerationLevel(appliedPersonId);
    } catch { /* non-bloking */ }
  }

  await notifySubmissionStatus(submission.id, "APPROVED");
  await logAudit({
    action: "SUBMISSION_APPROVE",
    entityType: "Submission",
    entityId: submission.id,
    beforeData: beforeSnapshot as any,
    afterData: submission.payload as any,
    actorUserId: user.id,
  });

  return NextResponse.json({ status: "APPROVED", appliedPersonId });
}

async function applySubmission(
  payload: Record<string, unknown>,
  type: string,
  targetPersonId?: string | null,
): Promise<string | null> {
  switch (type) {
    case "ADD_PERSON": {
      const person = await prisma.person.create({
        data: {
          fullName: payload.fullName as string,
          nickname: (payload.nickname as string) || null,
          gender: payload.gender as any,
          birthDate: payload.birthDate ? new Date(payload.birthDate as string) : null,
          birthPlace: (payload.birthPlace as string) || null,
          isDeceased: (payload.isDeceased as boolean) ?? false,
          deathDate: payload.deathDate ? new Date(payload.deathDate as string) : null,
          bio: (payload.bio as string) || null,
          branch: (payload.branchId as string)
            ? { connect: { id: payload.branchId as string } }
            : undefined,
        } as any,
      });
      return person.id;
    }

    case "ADD_CHILD": {
      const child = await prisma.person.create({
        data: {
          fullName: payload.fullName as string,
          gender: payload.gender as any,
          birthDate: payload.birthDate ? new Date(payload.birthDate as string) : null,
          birthPlace: (payload.birthPlace as string) || null,
        },
      });
      await prisma.personChild.create({
        data: {
          parentId: payload.parentId as string,
          childId: child.id,
          parentRole: (payload.parentRole as any) ?? "UNKNOWN",
          isStep: (payload.isStep as boolean) ?? false,
          isAdopted: (payload.isAdopted as boolean) ?? false,
        },
      });
      return child.id;
    }

    case "ADD_SPOUSE": {
      const spouse = await prisma.person.create({
        data: {
          fullName: payload.fullName as string,
          gender: payload.gender as any,
          isMarriedInto: true,
        },
      });
      await prisma.personPartner.create({
        data: {
          partnerAId: payload.personId as string,
          partnerBId: spouse.id,
          status: (payload.status as any) ?? "MARRIED",
          marriageDate: payload.marriageDate ? new Date(payload.marriageDate as string) : null,
          orderIndex: (payload.orderIndex as number) ?? 0,
        },
      });
      return spouse.id;
    }

    case "EDIT_PERSON": {
      if (!targetPersonId) throw new Error("targetPersonId diperlukan");
      await prisma.person.update({
        where: { id: targetPersonId },
        data: {
          ...(payload.fullName !== undefined && { fullName: payload.fullName as string }),
          ...(payload.nickname !== undefined && { nickname: (payload.nickname as string) || null }),
          ...(payload.bio !== undefined && { bio: (payload.bio as string) || null }),
          ...(payload.birthDate !== undefined && { birthDate: payload.birthDate ? new Date(payload.birthDate as string) : null }),
          ...(payload.birthPlace !== undefined && { birthPlace: (payload.birthPlace as string) || null }),
          ...(payload.isDeceased !== undefined && { isDeceased: payload.isDeceased as boolean }),
          ...(payload.deathDate !== undefined && { deathDate: payload.deathDate ? new Date(payload.deathDate as string) : null }),
        },
      });
      return targetPersonId;
    }

    case "EDIT_RELATION": {
      // Implementasi relation editing — cukup kompleks untuk MVP
      throw new Error("EDIT_RELATION belum diimplementasikan");
    }

    default:
      throw new Error(`Tipe pengajuan tidak dikenal: ${type}`);
  }
}
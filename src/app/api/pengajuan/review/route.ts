import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { notifySubmissionStatus } from "@/lib/notifications";
import { recalculateGenerationLevel } from "@/lib/genealogy";
import { orderIndexForChild, setChildOrderIndex, type ChildOrderDb } from "@/lib/child-order";

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

const MAX_PARENTS = 2;

/** Telusuri anak dari `ancestorId` untuk memastikan `descendantId` bukan keturunannya. */
async function isDescendant(ancestorId: string, descendantId: string): Promise<boolean> {
  const queue = [ancestorId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    if (current === descendantId) return true;

    const edges = await prisma.personChild.findMany({
      where: { parentId: current },
      select: { childId: true },
    });
    for (const edge of edges) {
      if (!visited.has(edge.childId)) queue.push(edge.childId);
    }
  }

  return false;
}

/** Validasi relasi orang tua-anak: batas dua orang tua dan anti-siklus. */
async function validateParentChild(parentId: string, childId: string): Promise<string | null> {
  if (parentId === childId) {
    return "Seseorang tidak dapat menjadi orang tua bagi dirinya sendiri.";
  }

  const parentCount = await prisma.personChild.count({ where: { childId } });
  if (parentCount >= MAX_PARENTS) {
    return `Anggota ini sudah memiliki ${MAX_PARENTS} orang tua. Hapus salah satu relasi terlebih dahulu.`;
  }

  if (await isDescendant(childId, parentId)) {
    return "Relasi ini akan membentuk siklus silsilah yang tidak valid.";
  }

  return null;
}

/** Terapkan satu aksi `EDIT_RELATION` dari payload pengajuan. */
async function applyEditRelation(payload: Record<string, unknown>): Promise<string | null> {
  const personId = payload.personId as string;
  const relationType = payload.relationType as string;
  const action = payload.action as string;
  const edgeId = payload.edgeId as string | undefined;
  const targetPersonId = payload.targetPersonId as string | undefined;
  const role = payload.role as string | undefined;

  if (!personId) throw new Error("personId diperlukan");

  if (relationType === "parent" || relationType === "child") {
    if (action === "add") {
      if (!targetPersonId) throw new Error("targetPersonId diperlukan");
      const parentId = relationType === "parent" ? targetPersonId : personId;
      const childId = relationType === "parent" ? personId : targetPersonId;

      const existing = await prisma.personChild.findFirst({ where: { parentId, childId } });
      if (existing) throw new Error("Relasi sudah ada");

      const invalid = await validateParentChild(parentId, childId);
      if (invalid) throw new Error(invalid);

      // Himpunan orang tua LENGKAP anak, supaya nomor urut dihitung dari
      // grup saudara sebenarnya, bukan hanya dari satu orang tua.
      const existingParents = await prisma.personChild.findMany({
        where: { childId },
        select: { parentId: true },
      });
      const parentIds = [...new Set([...existingParents.map((row) => row.parentId), parentId])];

      const nomor = await orderIndexForChild(
        childId,
        parentIds,
        prisma as unknown as ChildOrderDb,
      );
      await prisma.personChild.create({
        data: {
          parentId,
          childId,
          parentRole: (role as any) ?? "UNKNOWN",
          isStep: (payload.isStep as boolean) ?? false,
          isAdopted: (payload.isAdopted as boolean) ?? false,
          orderIndex: nomor,
        },
      });
      // Baris LAMA anak ikut bernomor sama supaya invariant per-edge terjaga.
      await setChildOrderIndex(childId, nomor, prisma as unknown as ChildOrderDb);
      try { await recalculateGenerationLevel(childId); } catch { /* non-bloking */ }
      return personId;
    }

    if (action === "remove") {
      if (!edgeId) throw new Error("edgeId diperlukan");
      const edge = await prisma.personChild.findUnique({ where: { id: edgeId } });
      if (!edge) throw new Error("Relasi tidak ditemukan");
      await prisma.personChild.delete({ where: { id: edgeId } });
      try { await recalculateGenerationLevel(edge.childId); } catch { /* non-bloking */ }
      return personId;
    }

    if (action === "update") {
      if (!edgeId) throw new Error("edgeId diperlukan");
      const edge = await prisma.personChild.findUnique({ where: { id: edgeId } });
      if (!edge) throw new Error("Relasi tidak ditemukan");
      await prisma.personChild.update({
        where: { id: edgeId },
        data: {
          ...(role !== undefined && { parentRole: role as any }),
          ...(payload.isStep !== undefined && { isStep: payload.isStep as boolean }),
          ...(payload.isAdopted !== undefined && { isAdopted: payload.isAdopted as boolean }),
        },
      });
      return personId;
    }

    throw new Error(`Aksi relasi tidak dikenal: ${action}`);
  }

  if (relationType === "partner") {
    if (action === "add") {
      if (!targetPersonId) throw new Error("targetPersonId diperlukan");
      const existing = await prisma.personPartner.findFirst({
        where: {
          OR: [
            { partnerAId: personId, partnerBId: targetPersonId },
            { partnerAId: targetPersonId, partnerBId: personId },
          ],
        },
      });
      if (existing) throw new Error("Relasi sudah ada");

      await prisma.personPartner.create({
        data: {
          partnerAId: personId,
          partnerBId: targetPersonId,
          status: (payload.status as any) ?? "MARRIED",
          marriageDate: payload.marriageDate ? new Date(payload.marriageDate as string) : null,
          orderIndex: await prisma.personPartner.count({
            where: { OR: [{ partnerAId: personId }, { partnerBId: personId }] },
          }),
        },
      });
      return personId;
    }

    if (action === "remove") {
      if (!edgeId) throw new Error("edgeId diperlukan");
      const edge = await prisma.personPartner.findUnique({ where: { id: edgeId } });
      if (!edge) throw new Error("Relasi tidak ditemukan");
      await prisma.personPartner.delete({ where: { id: edgeId } });
      return personId;
    }

    if (action === "update") {
      if (!edgeId) throw new Error("edgeId diperlukan");
      const edge = await prisma.personPartner.findUnique({ where: { id: edgeId } });
      if (!edge) throw new Error("Relasi tidak ditemukan");
      await prisma.personPartner.update({
        where: { id: edgeId },
        data: {
          ...(payload.status !== undefined && { status: payload.status as any }),
          ...(payload.marriageDate !== undefined && {
            marriageDate: payload.marriageDate ? new Date(payload.marriageDate as string) : null,
          }),
        },
      });
      return personId;
    }

    throw new Error(`Aksi relasi tidak dikenal: ${action}`);
  }

  throw new Error(`Tipe relasi tidak dikenal: ${relationType}`);
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
      submitter: { select: { id: true, person: { select: { gender: true } } } },
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
    appliedPersonId = await applySubmission(
      payload,
      submission.type,
      submission.targetPerson?.id,
      submission.id,
      submission.submitter?.person?.gender ?? null,
    );
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
      ...(body.reviewNote !== undefined && { reviewNote: (body.reviewNote as string) || null }),
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
  submissionId?: string,
  submitterGender?: string | null,
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
      const parentId = payload.parentId as string;
      const parent = await prisma.person.findUnique({
        where: { id: parentId },
        select: { id: true, branchId: true },
      });
      if (!parent) throw new Error("Orang tua tidak ditemukan");

      const parentRole =
        (payload.parentRole as string) ??
        (submitterGender === "MALE" ? "FATHER" : submitterGender === "FEMALE" ? "MOTHER" : "UNKNOWN");

      // Anak dan seluruh edge-nya ditulis dalam satu transaksi, supaya
      // kegagalan di tengah tidak menyisakan anak tanpa orang tua.
      return await prisma.$transaction(async (tx) => {
        const child = await tx.person.create({
          data: {
            fullName: payload.fullName as string,
            gender: payload.gender as any,
            birthDate: payload.birthDate ? new Date(payload.birthDate as string) : null,
            birthPlace: (payload.birthPlace as string) || null,
            branchId: parent.branchId ?? undefined,
          },
        });

        // Bila orang tua punya tepat satu pasangan, lengkapi orang tua kedua.
        // Himpunan orang tua LENGKAP dihitung sekali, lalu SATU nomor dipakai
        // untuk kedua baris anak itu agar tidak berbeda.
        const partners = await tx.personPartner.findMany({
          where: { OR: [{ partnerAId: parentId }, { partnerBId: parentId }] },
          select: { partnerAId: true, partnerBId: true },
        });
        const otherParentId =
          partners.length === 1
            ? partners[0].partnerAId === parentId
              ? partners[0].partnerBId
              : partners[0].partnerAId
            : null;
        const parentIds = otherParentId ? [parentId, otherParentId] : [parentId];
        const orderIndex = await orderIndexForChild(child.id, parentIds, tx as ChildOrderDb);

        await tx.personChild.create({
          data: {
            parentId,
            childId: child.id,
            parentRole: parentRole as any,
            isStep: (payload.isStep as boolean) ?? false,
            isAdopted: (payload.isAdopted as boolean) ?? false,
            orderIndex,
            ...(submissionId ? { sourceSubmissionId: submissionId } : {}),
          },
        });

        if (otherParentId) {
          const otherRole =
            parentRole === "FATHER" ? "MOTHER" : parentRole === "MOTHER" ? "FATHER" : "UNKNOWN";
          const duplicate = await tx.personChild.findFirst({
            where: { parentId: otherParentId, childId: child.id },
          });
          if (!duplicate) {
            await tx.personChild.create({
              data: {
                parentId: otherParentId,
                childId: child.id,
                parentRole: otherRole as any,
                orderIndex,
                ...(submissionId ? { sourceSubmissionId: submissionId } : {}),
              },
            });
          }
        }

        return child.id;
      });
    }

    case "ADD_SPOUSE": {
      const personId = payload.personId as string;
      const person = await prisma.person.findUnique({
        where: { id: personId },
        select: { id: true, branchId: true },
      });
      if (!person) throw new Error("Anggota tidak ditemukan");

      return await prisma.$transaction(async (tx) => {
        const spouse = await tx.person.create({
          data: {
            fullName: payload.fullName as string,
            gender: payload.gender as any,
            isMarriedInto: true,
            branchId: person.branchId ?? undefined,
          },
        });
        await tx.personPartner.create({
          data: {
            partnerAId: personId,
            partnerBId: spouse.id,
            status: (payload.status as any) ?? "MARRIED",
            marriageDate: payload.marriageDate ? new Date(payload.marriageDate as string) : null,
            orderIndex: (payload.orderIndex as number) ?? 0,
          },
        });
        return spouse.id;
      });
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
      return applyEditRelation(payload);
    }

    default:
      throw new Error(`Tipe pengajuan tidak dikenal: ${type}`);
  }
}
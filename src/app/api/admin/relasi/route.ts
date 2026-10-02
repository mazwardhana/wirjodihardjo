import { NextResponse } from "next/server";
import type { Gender, ParentRole, PartnerStatus, Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { recalculateGenerationLevel } from "@/lib/genealogy";
import { moveChild, orderIndexForChild, setChildOrderIndex, type ChildOrderDb } from "@/lib/child-order";
import {
  autoLinkChildToPartner,
  autoLinkChildrenToPartner,
  partnerRoleFromGender,
  solePartnerId,
  type RelationSyncDb,
} from "@/lib/relation-sync";
import { requireAdminScope, assertPersonAccess, AuthorizationError } from "@/lib/rbac";

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

/**
 * Validasi relasi orang tua-anak: batas dua orang tua dan anti-siklus.
 * Mengembalikan pesan error yang aman ditampilkan, atau null jika valid.
 */
async function validateParentChild(
  parentId: string,
  childId: string,
): Promise<string | null> {
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

/** Peran pasangan orang tua, dihitung dari jenis kelamin pasangan tunggalnya. */
async function partnerRoleForParent(
  parentId: string,
  db: { personChild: RelationSyncDb["personChild"]; personPartner: RelationSyncDb["personPartner"]; person: { findUnique(args: unknown): Promise<{ gender?: string } | null> } },
): Promise<{ partnerId: string; role: ReturnType<typeof partnerRoleFromGender> } | null> {
  const partnerId = await solePartnerId(parentId, db as unknown as RelationSyncDb);
  if (!partnerId) return null;
  const partner = await db.person.findUnique({ where: { id: partnerId }, select: { gender: true } });
  return { partnerId, role: partnerRoleFromGender(partner?.gender ?? "UNKNOWN") };
}

/**
 * API relasi untuk admin: tambah/hapus relasi keluarga.
 * Setiap perubahan diaudit dan memicu rekalkulasi generasi.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  try {
    const scope = await requireAdminScope(session.user.id);

    let body: Record<string, unknown>;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: "Body tidak valid" }, { status: 400 }); }

    const action = body.action as string;

    switch (action) {
      case "add": {
        const personId = body.personId as string;
        const relationType = body.relationType as string;
        const targetPersonId = body.targetPersonId as string;
        const role = body.role as string | undefined;

        if (!personId || !targetPersonId) {
          return NextResponse.json({ error: "personId dan targetPersonId diperlukan" }, { status: 400 });
        }

        // Validate access to both endpoints of the relation
        await assertPersonAccess(scope, personId);
        await assertPersonAccess(scope, targetPersonId);

        const [person, target] = await Promise.all([
          prisma.person.findUnique({ where: { id: personId } }),
          prisma.person.findUnique({ where: { id: targetPersonId } }),
        ]);
        if (!person || !target) {
          return NextResponse.json({ error: "Anggota tidak ditemukan" }, { status: 404 });
        }

        let linkedPartnerId: string | null = null;
        let linkedChildIds: string[] = [];

      if (relationType === "parent") {
        // Cek duplikasi edge
        const existing = await prisma.personChild.findFirst({
          where: { parentId: targetPersonId, childId: personId },
        });
        if (existing) {
          return NextResponse.json({ error: "Relasi sudah ada" }, { status: 409 });
        }
        const invalid = await validateParentChild(targetPersonId, personId);
        if (invalid) {
          return NextResponse.json({ error: invalid }, { status: 409 });
        }
        // Himpunan orang tua LENGKAP anak, supaya nomor urut dihitung dari
        // grup saudara sebenarnya, bukan hanya dari satu orang tua. Baca dan
        // kedua tulis dibungkus satu transaksi supaya baris anak selalu
        // bernomor sama.
        await prisma.$transaction(async (tx) => {
          const existingParents = await tx.personChild.findMany({
            where: { childId: personId },
            select: { parentId: true },
          });
          const parentIds = [
            ...new Set([...existingParents.map((row) => row.parentId), targetPersonId]),
          ];
          const nomor = await orderIndexForChild(
            personId,
            parentIds,
            tx as unknown as ChildOrderDb,
          );
          await tx.personChild.create({
            data: {
              parentId: targetPersonId,
              childId: personId,
              parentRole: (role as ParentRole) ?? "UNKNOWN",
              orderIndex: nomor,
            },
          });
          // Baris LAMA anak ikut bernomor sama supaya invariant per-edge terjaga.
          await setChildOrderIndex(personId, nomor, tx as unknown as ChildOrderDb);
        });
        // Satu panggilan cukup: rekalkulasi menghitung seluruh komponen.
        try { await recalculateGenerationLevel(personId); } catch {}
      } else if (relationType === "child") {
        const existing = await prisma.personChild.findFirst({
          where: { parentId: personId, childId: targetPersonId },
        });
        if (existing) {
          return NextResponse.json({ error: "Relasi sudah ada" }, { status: 409 });
        }
        const invalid = await validateParentChild(personId, targetPersonId);
        if (invalid) {
          return NextResponse.json({ error: invalid }, { status: 409 });
        }
        // Himpunan orang tua LENGKAP anak, supaya nomor urut dihitung dari
        // grup saudara sebenarnya, bukan hanya dari satu orang tua. Baca dan
        // kedua tulis dibungkus satu transaksi supaya baris anak selalu
        // bernomor sama.
        await prisma.$transaction(async (tx) => {
          const existingParents = await tx.personChild.findMany({
            where: { childId: targetPersonId },
            select: { parentId: true },
          });
          const parentIds = [
            ...new Set([...existingParents.map((row) => row.parentId), personId]),
          ];
          const nomor = await orderIndexForChild(
            targetPersonId,
            parentIds,
            tx as unknown as ChildOrderDb,
          );
          await tx.personChild.create({
            data: {
              parentId: personId,
              childId: targetPersonId,
              parentRole: (role as ParentRole) ?? "UNKNOWN",
              orderIndex: nomor,
            },
          });
          // Baris LAMA anak ikut bernomor sama supaya invariant per-edge terjaga.
          await setChildOrderIndex(targetPersonId, nomor, tx as unknown as ChildOrderDb);

          const pasangan = await partnerRoleForParent(personId, tx as never);
          if (pasangan) {
            const link = await autoLinkChildToPartner(
              targetPersonId,
              personId,
              pasangan.role,
              tx as unknown as RelationSyncDb,
            );
            linkedPartnerId = link.linkedPartnerId;
          }
        });
        // Satu panggilan cukup: rekalkulasi menghitung seluruh komponen.
        try { await recalculateGenerationLevel(targetPersonId); } catch {}
      } else if (relationType === "partner") {
        const existing = await prisma.personPartner.findFirst({
          where: {
            OR: [
              { partnerAId: personId, partnerBId: targetPersonId },
              { partnerAId: targetPersonId, partnerBId: personId },
            ],
          },
        });
        if (existing) {
          return NextResponse.json({ error: "Relasi sudah ada" }, { status: 409 });
        }
        await prisma.personPartner.create({
          data: {
            partnerAId: personId,
            partnerBId: targetPersonId,
            status: "MARRIED",
            orderIndex: await prisma.personPartner.count({
              where: { OR: [{ partnerAId: personId }, { partnerBId: personId }] },
            }),
          },
        });
        const linked = await autoLinkChildrenToPartner(
          personId,
          targetPersonId,
          partnerRoleFromGender(target.gender),
          prisma as unknown as RelationSyncDb,
        );
        linkedChildIds = linked.linkedChildIds;
      } else {
        return NextResponse.json({ error: "Tipe relasi tidak dikenal" }, { status: 400 });
      }

        await logAudit({
          action: `RELATION_ADD_${relationType.toUpperCase()}`,
          entityType: "Person",
          entityId: personId,
          afterData: { relationType, targetPersonId } as Prisma.InputJsonValue,
          actorUserId: session.user.id,
        });

        return NextResponse.json({ ok: true, linkedPartnerId, linkedChildIds });
      }

      case "add-new": {
        const relationType = body.relationType as string;
        const personId = body.personId as string;
        const role = body.role as string | undefined;
        const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
        const gender = body.gender as string;
        const birthDate = typeof body.birthDate === "string" ? body.birthDate.trim() : "";
        const birthPlace = typeof body.birthPlace === "string" ? body.birthPlace.trim() : "";

        let linkedPartnerId: string | null = null;
        let linkedChildIds: string[] = [];

        if (!personId) {
          return NextResponse.json({ error: "personId diperlukan" }, { status: 400 });
        }
        if (!fullName) {
          return NextResponse.json({ error: "Nama lengkap wajib diisi" }, { status: 400 });
        }
        if (!["MALE", "FEMALE", "OTHER"].includes(gender)) {
          return NextResponse.json({ error: "Jenis kelamin tidak valid" }, { status: 400 });
        }
        if (relationType !== "parent" && relationType !== "child" && relationType !== "partner") {
          return NextResponse.json({ error: "Tipe relasi tidak dikenal" }, { status: 400 });
        }

        // `new Date("abc")` menghasilkan Invalid Date; Prisma lalu melempar dan
        // balasan menjadi 500, jadi tanggal diperiksa di sini agar menjadi 400.
        let birthDateValue: Date | null = null;
        if (birthDate) {
          const parsedBirthDate = new Date(birthDate);
          if (Number.isNaN(parsedBirthDate.getTime())) {
            return NextResponse.json({ error: "Tanggal lahir tidak valid" }, { status: 400 });
          }
          birthDateValue = parsedBirthDate;
        }

        await assertPersonAccess(scope, personId);
        const person = await prisma.person.findUnique({ where: { id: personId } });
        if (!person) {
          return NextResponse.json({ error: "Anggota tidak ditemukan" }, { status: 404 });
        }

        // Orang baru belum punya relasi apa pun, jadi anti-siklus tidak relevan;
        // yang perlu dijaga hanya batas dua orang tua pada orang fokus.
        if (relationType === "parent") {
          const parentCount = await prisma.personChild.count({ where: { childId: personId } });
          if (parentCount >= MAX_PARENTS) {
            return NextResponse.json(
              {
                error: `Anggota ini sudah memiliki ${MAX_PARENTS} orang tua. Hapus salah satu relasi terlebih dahulu.`,
              },
              { status: 409 },
            );
          }
        }

        const parentRole =
          relationType === "child"
            ? ((role as string) ??
              (person.gender === "MALE"
                ? "FATHER"
                : person.gender === "FEMALE"
                  ? "MOTHER"
                  : "UNKNOWN"))
            : relationType === "parent"
              ? ((role as string) ?? "UNKNOWN")
              : "UNKNOWN";

        const partnerCount =
          relationType === "partner"
            ? await prisma.personPartner.count({
                where: { OR: [{ partnerAId: personId }, { partnerBId: personId }] },
              })
            : 0;

        const createdId = await prisma.$transaction(async (tx) => {
          const created = await tx.person.create({
            data: {
              fullName,
              gender: gender as Gender,
              birthDate: birthDateValue,
              birthPlace: birthPlace || null,
              branchId: person.branchId ?? undefined,
              isMarriedInto: relationType === "partner",
            },
          });

          if (relationType === "parent") {
            // Orang tua baru ditambah ke himpunan orang tua LENGKAP anak.
            const existingParents = await tx.personChild.findMany({
              where: { childId: personId },
              select: { parentId: true },
            });
            const parentIds = [
              ...new Set([...existingParents.map((row) => row.parentId), created.id]),
            ];
            const nomor = await orderIndexForChild(personId, parentIds, tx as ChildOrderDb);
            await tx.personChild.create({
              data: {
                parentId: created.id,
                childId: personId,
                parentRole: parentRole as ParentRole,
                orderIndex: nomor,
              },
            });
            // Anak sudah ada, jadi baris LAMA-nya ikut disamakan.
            await setChildOrderIndex(personId, nomor, tx as ChildOrderDb);
          } else if (relationType === "child") {
            await tx.personChild.create({
              data: {
                parentId: personId,
                childId: created.id,
                parentRole: parentRole as ParentRole,
                orderIndex: await orderIndexForChild(created.id, [personId], tx as ChildOrderDb),
              },
            });
            const pasangan = await partnerRoleForParent(personId, tx as never);
            if (pasangan) {
              const link = await autoLinkChildToPartner(created.id, personId, pasangan.role, tx as unknown as RelationSyncDb);
              linkedPartnerId = link.linkedPartnerId;
            }
          } else {
            await tx.personPartner.create({
              data: {
                partnerAId: personId,
                partnerBId: created.id,
                status: "MARRIED",
                orderIndex: partnerCount,
              },
            });
            const link = await autoLinkChildrenToPartner(
              personId,
              created.id,
              partnerRoleFromGender(gender),
              tx as unknown as RelationSyncDb,
            );
            linkedChildIds = link.linkedChildIds;
          }

          return created.id;
        });

        if (relationType !== "partner") {
          // Satu panggilan cukup: rekalkulasi menghitung seluruh komponen.
          try { await recalculateGenerationLevel(personId); } catch {}
        }

        await logAudit({
          action: `RELATION_ADD_${relationType.toUpperCase()}_NEW`,
          entityType: "Person",
          entityId: personId,
          afterData: { relationType, fullName } as Prisma.InputJsonValue,
          actorUserId: session.user.id,
        });

        return NextResponse.json({ ok: true, personId: createdId, linkedPartnerId, linkedChildIds }, { status: 201 });
      }

      case "remove": {
        const { edgeId, relationType } = body;
        if (!edgeId) {
          return NextResponse.json({ error: "edgeId diperlukan" }, { status: 400 });
        }

        if (relationType === "parent" || relationType === "child") {
          const edge = await prisma.personChild.findUnique({ where: { id: edgeId as string } });
          if (!edge) {
            return NextResponse.json({ error: "Relasi tidak ditemukan" }, { status: 404 });
          }

          // Validate access to both endpoints of the relation
          await assertPersonAccess(scope, edge.parentId);
          await assertPersonAccess(scope, edge.childId);

          await prisma.personChild.delete({ where: { id: edgeId as string } });
          // Satu panggilan cukup: komponen sudah mencakup kedua sisi relasi.
          try { await recalculateGenerationLevel(edge.childId); } catch {}
        } else if (relationType === "partner") {
          const edge = await prisma.personPartner.findUnique({ where: { id: edgeId as string } });
          if (!edge) {
            return NextResponse.json({ error: "Relasi tidak ditemukan" }, { status: 404 });
          }

          // Validate access to both partners
          await assertPersonAccess(scope, edge.partnerAId);
          await assertPersonAccess(scope, edge.partnerBId);

          await prisma.personPartner.delete({ where: { id: edgeId as string } });
        }

        await logAudit({
          action: `RELATION_REMOVE_${(relationType as string).toUpperCase()}`,
          entityType: "Person",
          entityId: body.personId as string,
          actorUserId: session.user.id,
        });

        return NextResponse.json({ ok: true });
      }

      case "restore-person": {
        const pId = body.personId as string;
        if (scope.role !== "SUPER_ADMIN") {
          return NextResponse.json({ error: "Hanya Super Admin" }, { status: 403 });
        }
        const existing = await prisma.person.findUnique({ where: { id: pId } });
        if (!existing || !existing.deletedAt) {
          return NextResponse.json({ error: "Anggota tidak ada di arsip" }, { status: 404 });
        }
        await prisma.person.update({
          where: { id: pId },
          data: { deletedAt: null },
        });
        await logAudit({
          action: "PERSON_RESTORE",
          entityType: "Person",
          entityId: pId,
          actorUserId: session.user.id,
        });
        return NextResponse.json({ ok: true });
      }

      case "add-note": {
        const pId2 = body.personId as string;
        const noteBody = body.body as string;
        if (!pId2 || !noteBody?.trim()) {
          return NextResponse.json({ error: "personId dan body diperlukan" }, { status: 400 });
        }
        
        // Validate access to person before adding note
        await assertPersonAccess(scope, pId2);
        
        const note = await prisma.adminNote.create({
          data: {
            personId: pId2,
            body: noteBody.trim(),
            authorId: session.user.id,
          },
        });
        return NextResponse.json(note);
      }

      case "reorder-child": {
        const childId = body.childId as string;
        const direction = body.direction as string;

        if (!childId || (direction !== "up" && direction !== "down")) {
          return NextResponse.json(
            { error: "childId dan direction (\"up\" atau \"down\") diperlukan" },
            { status: 400 },
          );
        }

        await assertPersonAccess(scope, childId);

        const moved = await moveChild(childId, direction);
        if (!moved) {
          return NextResponse.json(
            { error: "Anak tidak ditemukan atau sudah berada di urutan paling ujung." },
            { status: 409 },
          );
        }

        await logAudit({
          action: "RELATION_REORDER_CHILD",
          entityType: "Person",
          entityId: childId,
          actorUserId: session.user.id,
        });

        return NextResponse.json({ ok: true });
      }

      case "edit-relation": {
        const edgeId = body.edgeId as string;
        const relationType = body.relationType as string;
        if (!edgeId || (relationType !== "parent" && relationType !== "child")) {
          return NextResponse.json(
            { error: "edgeId dan relationType (\"parent\" atau \"child\") diperlukan" },
            { status: 400 },
          );
        }

        const edge = await prisma.personChild.findUnique({ where: { id: edgeId } });
        if (!edge) return NextResponse.json({ error: "Relasi tidak ditemukan" }, { status: 404 });
        await assertPersonAccess(scope, edge.parentId);
        await assertPersonAccess(scope, edge.childId);

        const newTargetPersonId = body.newTargetPersonId as string | undefined;
        const attrs = {
          parentRole: (body.parentRole as ParentRole | undefined) ?? edge.parentRole,
          isStep: typeof body.isStep === "boolean" ? body.isStep : edge.isStep,
          isAdopted: typeof body.isAdopted === "boolean" ? body.isAdopted : edge.isAdopted,
        };

        if (newTargetPersonId && newTargetPersonId !== (relationType === "child" ? edge.childId : edge.parentId)) {
          const newChildId = relationType === "child" ? newTargetPersonId : edge.childId;
          const newParentId = relationType === "parent" ? newTargetPersonId : edge.parentId;
          await assertPersonAccess(scope, newTargetPersonId);

          if (newParentId === newChildId) {
            return NextResponse.json(
              { error: "Seseorang tidak dapat menjadi orang tua bagi dirinya sendiri." },
              { status: 409 },
            );
          }
          const duplicate = await prisma.personChild.findFirst({
            where: { parentId: newParentId, childId: newChildId },
          });
          if (duplicate) return NextResponse.json({ error: "Relasi sudah ada" }, { status: 409 });

          if (relationType === "child") {
            const parentCount = await prisma.personChild.count({ where: { childId: newChildId } });
            if (parentCount >= MAX_PARENTS) {
              return NextResponse.json(
                { error: `Anggota ini sudah memiliki ${MAX_PARENTS} orang tua. Hapus salah satu relasi terlebih dahulu.` },
                { status: 409 },
              );
            }
          }
          // Siklus standar: calon orang tua tidak boleh keturunan calon anak.
          const invalid = await validateParentChild(newParentId, newChildId);
          if (invalid) return NextResponse.json({ error: invalid }, { status: 409 });
          // Saat mengganti sisi anak pada edge yang sudah ada, calon anak tidak
          // boleh justru keturunan orang tua yang sama; relasi langsung semacam
          // itu melipat cabang ke atas dirinya sendiri.
          if (relationType === "child" && (await isDescendant(newParentId, newChildId))) {
            return NextResponse.json(
              { error: "Relasi ini akan membentuk siklus silsilah yang tidak valid." },
              { status: 409 },
            );
          }

          await prisma.$transaction(async (tx) => {
            await tx.personChild.update({
              where: { id: edgeId },
              data:
                relationType === "child"
                  ? { childId: newChildId, ...attrs }
                  : { parentId: newParentId, ...attrs },
            });
            const parents = await tx.personChild.findMany({
              where: { childId: newChildId },
              select: { parentId: true },
            });
            const parentIds = [...new Set(parents.map((row) => row.parentId))];
            const nomor = await orderIndexForChild(
              newChildId,
              parentIds,
              tx as unknown as ChildOrderDb,
            );
            await setChildOrderIndex(newChildId, nomor, tx as unknown as ChildOrderDb);
          });
          try { await recalculateGenerationLevel(newChildId); } catch {}
          if (relationType === "child") {
            try { await recalculateGenerationLevel(edge.childId); } catch {}
          }
        } else {
          await prisma.personChild.update({ where: { id: edgeId }, data: attrs });
          try { await recalculateGenerationLevel(edge.childId); } catch {}
        }

        await logAudit({
          action: "RELATION_UPDATE_CHILD",
          entityType: "Person",
          entityId: edge.childId,
          beforeData: edge as unknown as Prisma.InputJsonValue,
          afterData: body as unknown as Prisma.InputJsonValue,
          actorUserId: session.user.id,
        });
        return NextResponse.json({ ok: true });
      }

      case "edit-partner": {
        const edgeId = body.edgeId as string;
        if (!edgeId) return NextResponse.json({ error: "edgeId diperlukan" }, { status: 400 });

        const edge = await prisma.personPartner.findUnique({ where: { id: edgeId } });
        if (!edge) return NextResponse.json({ error: "Relasi tidak ditemukan" }, { status: 404 });
        await assertPersonAccess(scope, edge.partnerAId);
        await assertPersonAccess(scope, edge.partnerBId);

        const newPartnerId = body.newPartnerId as string | undefined;
        const oldPartnerId = body.oldPartnerId as string | undefined;
        const data: Prisma.PersonPartnerUncheckedUpdateInput = {};
        let keptAuditId = edge.partnerAId;

        if (newPartnerId && newPartnerId !== edge.partnerAId && newPartnerId !== edge.partnerBId) {
          const a = edge.partnerAId;
          const b = edge.partnerBId;
          let replaceA: boolean;
          if (oldPartnerId) {
            if (oldPartnerId === a) replaceA = true;
            else if (oldPartnerId === b) replaceA = false;
            else {
              return NextResponse.json({ error: "Pasangan yang diganti tidak termasuk pada relasi ini." }, { status: 400 });
            }
          } else {
            replaceA = false; // legacy fallback, keep old default behaviour
          }
          await assertPersonAccess(scope, newPartnerId);
          const keptId = replaceA ? b : a;
          keptAuditId = keptId;
          const duplicate = await prisma.personPartner.findFirst({
            where: {
              OR: [
                { partnerAId: keptId, partnerBId: newPartnerId },
                { partnerAId: newPartnerId, partnerBId: keptId },
              ],
            },
          });
          if (duplicate) return NextResponse.json({ error: "Relasi sudah ada" }, { status: 409 });
          if (replaceA) data.partnerAId = newPartnerId;
          else data.partnerBId = newPartnerId;
        }

        if (body.status !== undefined) {
          if (!["MARRIED", "DIVORCED", "WIDOWED", "UNKNOWN"].includes(body.status as string)) {
            return NextResponse.json({ error: "Status pernikahan tidak valid" }, { status: 400 });
          }
          data.status = body.status as PartnerStatus;
        }
        for (const field of ["marriageDate", "divorceDate"] as const) {
          if (body[field] !== undefined) {
            if (body[field] === null || body[field] === "") {
              data[field] = null;
            } else {
              const parsed = new Date(body[field] as string);
              if (Number.isNaN(parsed.getTime())) {
                return NextResponse.json({ error: "Tanggal tidak valid" }, { status: 400 });
              }
              data[field] = parsed;
            }
          }
        }
        if (body.notes !== undefined) data.notes = body.notes === null ? null : String(body.notes);

        await prisma.personPartner.update({ where: { id: edgeId }, data });

        await logAudit({
          action: "RELATION_UPDATE_PARTNER",
          entityType: "Person",
          entityId: keptAuditId,
          beforeData: edge as unknown as Prisma.InputJsonValue,
          afterData: body as unknown as Prisma.InputJsonValue,
          actorUserId: session.user.id,
        });
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ error: "Action tidak dikenal" }, { status: 400 });
    }
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
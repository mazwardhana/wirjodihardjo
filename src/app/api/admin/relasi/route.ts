import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { recalculateGenerationLevel } from "@/lib/genealogy";
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
        await prisma.personChild.create({
          data: {
            parentId: targetPersonId,
            childId: personId,
            parentRole: (role as any) ?? "UNKNOWN",
          },
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
        await prisma.personChild.create({
          data: {
            parentId: personId,
            childId: targetPersonId,
            parentRole: (role as any) ?? "UNKNOWN",
          },
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
      } else {
        return NextResponse.json({ error: "Tipe relasi tidak dikenal" }, { status: 400 });
      }

        await logAudit({
          action: `RELATION_ADD_${relationType.toUpperCase()}`,
          entityType: "Person",
          entityId: personId,
          afterData: { relationType, targetPersonId } as any,
          actorUserId: session.user.id,
        });

        return NextResponse.json({ ok: true });
      }

      case "add-new": {
        const relationType = body.relationType as string;
        const personId = body.personId as string;
        const role = body.role as string | undefined;
        const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
        const gender = body.gender as string;
        const birthDate = typeof body.birthDate === "string" ? body.birthDate.trim() : "";
        const birthPlace = typeof body.birthPlace === "string" ? body.birthPlace.trim() : "";

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
              gender: gender as any,
              birthDate: birthDateValue,
              birthPlace: birthPlace || null,
              branchId: person.branchId ?? undefined,
              isMarriedInto: relationType === "partner",
            },
          });

          if (relationType === "parent") {
            await tx.personChild.create({
              data: { parentId: created.id, childId: personId, parentRole: parentRole as any },
            });
          } else if (relationType === "child") {
            await tx.personChild.create({
              data: { parentId: personId, childId: created.id, parentRole: parentRole as any },
            });
          } else {
            await tx.personPartner.create({
              data: {
                partnerAId: personId,
                partnerBId: created.id,
                status: "MARRIED",
                orderIndex: partnerCount,
              },
            });
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
          afterData: { relationType, fullName } as any,
          actorUserId: session.user.id,
        });

        return NextResponse.json({ ok: true, personId: createdId }, { status: 201 });
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
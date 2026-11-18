import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Gender, ParentRole, PartnerStatus } from "@prisma/client";
import { GEDCOM_IMPORT_TYPE, type GedcomBatchPayload, type GedcomPlan } from "./types";

/**
 * Commit batch impor GEDCOM.
 *
 * Mengikuti pola `commitRegistrasiImport`: baris batch dikunci dengan FOR
 * UPDATE di dalam transaksi serializable supaya klik ganda tidak menggandakan
 * data. Berbeda dari impor registrasi, di sini tidak ada akun User yang
 * dibuat, karena GEDCOM hanya membawa data silsilah.
 */

export class GedcomImportError extends Error {
  constructor(message: string, public status = 400, public errors: GedcomPlan["errors"] = []) {
    super(message);
  }
}

/** Batas minimal transaksi yang dibutuhkan alur commit. */
type GedcomCommitTx = {
  user: {
    findUnique(args: unknown): Promise<{
      isActive: boolean;
      role: string;
      mustChangeCredentials: boolean;
    } | null>;
  };
  importBatch: {
    findUnique(args: unknown): Promise<{ id: string; type: string; status: string; reportJson: unknown } | null>;
    update(args: unknown): Promise<unknown>;
  };
  person: {
    create(args: unknown): Promise<{ id: string }>;
    findUnique(args: unknown): Promise<{ id: string } | null>;
  };
  personChild: {
    create(args: unknown): Promise<{ id: string }>;
  };
  personPartner: {
    create(args: unknown): Promise<{ id: string }>;
  };
  auditLog: {
    create(args: unknown): Promise<unknown>;
  };
};

/** Snapshot ID hasil commit, disimpan di payload batch untuk kebutuhan rollback. */
type GedcomCommitSnapshot = {
  createdPersonIds: string[];
  createdChildEdgeIds: string[];
  createdPartnerEdgeIds: string[];
};

function snapshotFromPayload(payload: GedcomBatchPayload): GedcomCommitSnapshot {
  return {
    createdPersonIds: payload.createdPersonIds ?? [],
    createdChildEdgeIds: payload.createdChildEdgeIds ?? [],
    createdPartnerEdgeIds: payload.createdPartnerEdgeIds ?? [],
  };
}

function parentRoleFor(gender: string | undefined): ParentRole {
  if (gender === "MALE") return "FATHER";
  if (gender === "FEMALE") return "MOTHER";
  return "UNKNOWN";
}

function partnerStatusFor(status: string | undefined): PartnerStatus {
  if (status === "MARRIED" || status === "DIVORCED" || status === "WIDOWED") {
    return status;
  }
  return "UNKNOWN";
}

export async function commitGedcomImport(
  batchId: string,
  actorId: string,
): Promise<{ counts: GedcomBatchPayload["counts"]; skipped: number }> {
  try {
    return await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "ImportBatch" WHERE "id" = ${batchId} FOR UPDATE`;

        const batch = await tx.importBatch.findUnique({ where: { id: batchId } });
        if (!batch) throw new GedcomImportError("Batch tidak ditemukan.", 404);
        if (batch.type !== GEDCOM_IMPORT_TYPE) {
          throw new GedcomImportError("Batch bukan impor GEDCOM.", 409);
        }
        if (batch.status !== "VALIDATED") {
          throw new GedcomImportError("Batch sudah diproses.", 409);
        }

        const user = await tx.user.findUnique({ where: { id: actorId } });
        if (!user?.isActive || user.role !== "SUPER_ADMIN" || user.mustChangeCredentials) {
          throw new GedcomImportError("Akses impor ditolak.", 403);
        }

        const payload = batch.reportJson as GedcomBatchPayload | null;
        if (!payload?.data) throw new GedcomImportError("Data batch tidak lengkap.");

        const gedTx = tx as unknown as GedcomCommitTx;
        const data = payload.data;
        const persons = data.persons ?? [];
        const families = data.families ?? [];

        const counts: GedcomBatchPayload["counts"] = {
          total: persons.length,
          personsCreated: 0,
          personsSkipped: 0,
          childEdgesCreated: 0,
          partnerEdgesCreated: 0,
        };

        // Snapshot ID yang dibuat dalam commit ini. Dihitung dari payload yang
        // sudah ada (kalau ada) supaya rollback berikutnya idempoten — commit
        // yang diulang setelah gagal sebagian tidak menambah ID dua kali.
        const snapshot = snapshotFromPayload(payload);
        const createdPersonIds = new Set(snapshot.createdPersonIds);
        const createdChildEdgeIds = new Set(snapshot.createdChildEdgeIds);
        const createdPartnerEdgeIds = new Set(snapshot.createdPartnerEdgeIds);

        // 1) Peta gedcomId → person.id. Orang yang sudah ada di DB tetap dipakai
        //    (untuk relasi); hanya yang belum ada yang dibuat baru.
        const gedcomToPersonId = new Map<string, string>();
        let skippedCount = 0;

        for (const person of persons) {
          const existing = await gedTx.person.findUnique({ where: { externalRef: person.gedcomId } });
          if (existing) {
            gedcomToPersonId.set(person.gedcomId, existing.id);
            counts.personsSkipped++;
            skippedCount++;
            continue;
          }

          try {
            const created = await gedTx.person.create({
              data: {
                externalRef: person.gedcomId,
                fullName: person.fullName,
                nickname: person.nickname || undefined,
                namaPanggilan: person.nickname || undefined,
                gender: person.gender as Gender,
                birthDate: person.birthDate,
                birthPlace: person.birthPlace || undefined,
                deathDate: person.deathDate,
                deathPlace: person.deathPlace || undefined,
                isDeceased: person.isDeceased,
                occupation: person.occupation || undefined,
                bio: person.notes || undefined,
              },
            });
            gedcomToPersonId.set(person.gedcomId, created.id);
            createdPersonIds.add(created.id);
            counts.personsCreated++;
          } catch (error) {
            if (
              error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === "P2002"
            ) {
              // Kunci unik lain (mis. slug/nama) menabrak data yang sudah ada.
              const byName = await gedTx.person.findUnique({ where: { externalRef: person.gedcomId } });
              if (byName) {
                gedcomToPersonId.set(person.gedcomId, byName.id);
                counts.personsSkipped++;
                skippedCount++;
                continue;
              }
              throw new GedcomImportError(
                `Data untuk ${person.gedcomId} (${person.fullName}) sudah ada dan tidak dapat diperbarui.`,
                409,
              );
            }
            throw error;
          }
        }

        // 2) Relasi anak-orang tua.
        for (const family of families) {
          const parentRefs = [family.husband, family.wife].filter(
            (ref): ref is string => Boolean(ref),
          );
          for (const parentRef of parentRefs) {
            const parentId = gedcomToPersonId.get(parentRef);
            if (!parentId) continue;
            const parentPerson = persons.find((p) => p.gedcomId === parentRef);
            const parentRole = parentRoleFor(parentPerson?.gender);

            for (const childRef of family.children) {
              const childId = gedcomToPersonId.get(childRef);
              if (!childId || childId === parentId) continue;
              try {
                const childEdge = await gedTx.personChild.create({
                  data: {
                    parentId,
                    childId,
                    parentRole: parentRole as ParentRole,
                  },
                });
                createdChildEdgeIds.add(childEdge.id);
                counts.childEdgesCreated++;
              } catch (error) {
                if (
                  error instanceof Prisma.PrismaClientKnownRequestError &&
                  error.code === "P2002"
                ) {
                  counts.personsSkipped++;
                  skippedCount++;
                  continue;
                }
                throw error;
              }
            }
          }
        }

        // 3) Relasi pasangan.
        for (const family of families) {
          if (!family.husband || !family.wife) continue;
          const partnerAId = gedcomToPersonId.get(family.husband);
          const partnerBId = gedcomToPersonId.get(family.wife);
          if (!partnerAId || !partnerBId || partnerAId === partnerBId) continue;

          try {
            const partnerEdge = await gedTx.personPartner.create({
              data: {
                partnerAId,
                partnerBId,
                status: partnerStatusFor(family.status) as PartnerStatus,
                marriageDate: family.marriageDate,
                divorceDate: family.divorceDate,
                notes: family.notes || undefined,
              },
            });
            createdPartnerEdgeIds.add(partnerEdge.id);
            counts.partnerEdgesCreated++;
          } catch (error) {
            if (
              error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === "P2002"
            ) {
              counts.personsSkipped++;
              skippedCount++;
              continue;
            }
            throw error;
          }
        }

        await gedTx.importBatch.update({
          where: { id: batchId },
          data: {
            status: "COMMITTED",
            successRows: counts.personsCreated,
            errorRows: 0,
            reportJson: {
              ...payload,
              counts,
              planPersons: payload.planPersons,
              createdPersonIds: Array.from(createdPersonIds),
              createdChildEdgeIds: Array.from(createdChildEdgeIds),
              createdPartnerEdgeIds: Array.from(createdPartnerEdgeIds),
            },
          },
        });

        await gedTx.auditLog.create({
          data: {
            action: "GEDCOM_IMPORT_COMMIT",
            entityType: "ImportBatch",
            entityId: batchId,
            actorUserId: actorId,
            afterData: counts,
          },
        });

        return { counts, skipped: skippedCount };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 120_000,
        maxWait: 10_000,
      },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      throw new GedcomImportError(
        "Data sedang diubah oleh proses lain. Muat ulang laporan sebelum mencoba lagi.",
        409,
      );
    }
    throw error;
  }
}
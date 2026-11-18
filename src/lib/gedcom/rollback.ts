import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { GEDCOM_IMPORT_TYPE, type GedcomBatchPayload } from "./types";
import { GedcomImportError } from "./commit";

/**
 * Rollback batch impor GEDCOM yang sudah di-commit.
 *
 * Menghapus dalam satu transaksi serializable seluruh efek commit:
 * relasi pasangan (PersonPartner), relasi anak-orang tua (PersonChild), lalu
 * orang yang dibuat batch ini (Person). Batch dikunci FOR UPDATE untuk
 * mencegah rollback ganda / commit bersamaan.
 *
 * Catatan: hanya Person yang id-nya tercatat di snapshot commit yang dihapus.
 * Relasi yang dibuat batch ini tapi menunjuk ke orang yang sudah ada
 * sebelumnya juga dihapus dari snapshot edge. Data lain (mis. Person yang
 * dibuat lalu ditautkan ke akun oleh proses lain) TIDAK dihapus — id batch
 * hanya menghapus apa yang commit-nya sendiri ciptakan.
 */
export async function rollbackGedcomImport(
  batchId: string,
  actorId: string,
): Promise<{ removedPersons: number; removedChildEdges: number; removedPartnerEdges: number }> {
  try {
    return await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "ImportBatch" WHERE "id" = ${batchId} FOR UPDATE`;

        const batch = await tx.importBatch.findUnique({
          where: { id: batchId },
          select: { id: true, type: true, status: true, reportJson: true, rolledBackAt: true },
        });
        if (!batch) throw new GedcomImportError("Batch tidak ditemukan.", 404);
        if (batch.type !== GEDCOM_IMPORT_TYPE) {
          throw new GedcomImportError("Batch bukan impor GEDCOM.", 409);
        }
        if (batch.status !== "COMMITTED") {
          throw new GedcomImportError("Batch belum di-commit, tidak perlu rollback.", 409);
        }
        if (batch.rolledBackAt) {
          throw new GedcomImportError("Batch sudah dibatalkan (rollback).", 409);
        }

        const user = await tx.user.findUnique({ where: { id: actorId } });
        if (!user?.isActive || user.role !== "SUPER_ADMIN" || user.mustChangeCredentials) {
          throw new GedcomImportError("Akses impor ditolak.", 403);
        }

        const payload = batch.reportJson as GedcomBatchPayload | null;
        const personIds = payload?.createdPersonIds ?? [];
        const childEdgeIds = payload?.createdChildEdgeIds ?? [];
        const partnerEdgeIds = payload?.createdPartnerEdgeIds ?? [];
        if (personIds.length === 0 && childEdgeIds.length === 0 && partnerEdgeIds.length === 0) {
          throw new GedcomImportError(
            "Batch tidak memiliki snapshot hasil commit; rollback tidak dapat dijalankan.",
            409,
          );
        }

        // 1) Hapus dulu relasi yang dibuat commit ini (FK ke Person). Angka
        //    diambil dari hasil deleteMany supaya laporan mencerminkan baris
        //    yang benar-benar terhapus (bisa lebih kecil bila sudah dihapus
        //    manual sebelumnya).
        const partnerResult =
          partnerEdgeIds.length > 0
            ? await tx.personPartner.deleteMany({ where: { id: { in: partnerEdgeIds } } })
            : { count: 0 };
        const childResult =
          childEdgeIds.length > 0
            ? await tx.personChild.deleteMany({ where: { id: { in: childEdgeIds } } })
            : { count: 0 };

        // 2) Hapus Person yang dibuat commit ini (kaskade menghapus turunan
        //    yang ikut dibuat: PersonPrivate, PersonStatus, dll.).
        const personResult =
          personIds.length > 0
            ? await tx.person.deleteMany({ where: { id: { in: personIds } } })
            : { count: 0 };

        // 3) Tandai batch sebagai dibatalkan + jejak audit.
        await tx.importBatch.update({
          where: { id: batchId },
          data: { rolledBackAt: new Date() },
        });

        await tx.auditLog.create({
          data: {
            action: "GEDCOM_IMPORT_ROLLBACK",
            entityType: "ImportBatch",
            entityId: batchId,
            actorUserId: actorId,
            afterData: {
              removedPersons: personResult.count,
              removedChildEdges: childResult.count,
              removedPartnerEdges: partnerResult.count,
            },
          },
        });

        return {
          removedPersons: personResult.count,
          removedChildEdges: childResult.count,
          removedPartnerEdges: partnerResult.count,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 120_000,
        maxWait: 10_000,
      },
    );
  } catch (error) {
    if (isRetryableConflict(error)) {
      throw new GedcomImportError(
        "Data sedang diubah oleh proses lain. Muat ulang laporan sebelum mencoba lagi.",
        409,
      );
    }
    throw error;
  }
}

/**
 * Deteksi konflik serialisasi/deadlock. Prisma 7 + adapter-pg melaporkan
 * konflik raw SQL sebagai P2010 dengan originalCode 40001/40P01, bukan P2034;
 * keduanya diperlakukan sama (minta pengguna memuat ulang).
 */
function isRetryableConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === "P2034") return true;
  if (error.code !== "P2010") return false;
  const cause = (error.meta as { driverAdapterError?: { cause?: { originalCode?: string } } } | undefined)
    ?.driverAdapterError?.cause;
  return cause?.originalCode === "40001" || cause?.originalCode === "40P01";
}

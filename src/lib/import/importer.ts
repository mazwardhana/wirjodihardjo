import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { validateImportData } from "./validate";
import type { ParsedData, ImportCounts, ImportBatchPayload, ValidationError } from "./types";

export class ImportError extends Error {
  constructor(message: string, public status = 400, public errors: ValidationError[] = []) {
    super(message);
  }
}

function emptyCounts(data: ParsedData): ImportCounts {
  return {
    anggota: data.anggota.length,
    relasi: 0,
    akun: 0,
    personsCreated: 0,
    personsUpdated: 0,
    accountsCreated: 0,
    accountsUpdated: 0,
    childEdgesCreated: 0,
    partnerEdgesCreated: 0,
    privateUpserts: 0,
  };
}

export async function analyzeImportData(data: ParsedData) {
  const refsWithValues = data.anggota.filter(r => r.ref).map(r => r.ref!);
  const people = refsWithValues.length > 0
    ? await prisma.person.findMany({
        where: { externalRef: { in: refsWithValues } },
        select: { externalRef: true },
      })
    : [];
  
  const existingRefs = new Set(people.map(p => p.externalRef));
  const counts = emptyCounts(data);
  
  counts.personsUpdated = data.anggota.filter(r => r.ref && existingRefs.has(r.ref)).length;
  counts.personsCreated = data.anggota.length - counts.personsUpdated;
  
  return { counts, credentials: [], existingRefs };
}

function rowError(sheet: ValidationError["sheet"], row: number, field: string, message: string): never {
  throw new ImportError(message, 400, [{ sheet, row, field, message }]);
}

function date(value?: string) {
  if (!value) return undefined;
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return new Date(
    match ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}T00:00:00Z` : `${value}T00:00:00Z`
  );
}

async function applyData(tx: Prisma.TransactionClient, data: ParsedData, actorId: string) {
  const counts = emptyCounts(data);

  for (const [index, row] of data.anggota.entries()) {
    const rowNo = row._row ?? index + 2;
    
    // Resolve branch by branchNumber.
    const branch = await tx.branch.findUnique({
      where: { branchNumber: row.cabangKe, isActive: true },
    });
    if (!branch) {
      rowError("Data", rowNo, "cabang_ke", `Cabang ke-${row.cabangKe} tidak ditemukan atau tidak aktif.`);
    }

    // Check if person exists by externalRef.
    const existing = row.ref ? await tx.person.findUnique({ where: { externalRef: row.ref } }) : null;
    if (existing?.deletedAt) {
      rowError("Data", rowNo, "ref", "Anggota diarsipkan. Pulihkan terlebih dahulu.");
    }

    const values = {
      fullName: row.namaLengkap,
      gender: row.jenisKelamin,
      nickname: row.namaPanggilan || undefined,
      birthDate: date(row.tanggalLahir),
      birthPlace: row.tempatLahir || undefined,
      branchId: branch.id,
      generationLevel: null as number | null, // Set by admin, not import
    };

    const person = existing
      ? await tx.person.update({ where: { id: existing.id }, data: values })
      : await tx.person.create({
          data: { ...values, externalRef: row.ref || undefined },
        });

    if (existing) {
      counts.personsUpdated++;
    } else {
      counts.personsCreated++;
    }

    // Store optional fields in PersonPrivate.
    const privateData = {
      city: row.kotaDomisili || undefined,
      phone: row.nomorTelepon || undefined,
      familyNotes: row.catatan || undefined,
    };

    if (Object.values(privateData).some(Boolean)) {
      await tx.personPrivate.upsert({
        where: { personId: person.id },
        update: privateData,
        create: { personId: person.id, ...privateData },
      });
      counts.privateUpserts++;
    }
  }

  return { counts, credentials: [] };
}

export async function commitImportData(batchId: string, actorId: string) {
  try {
    return await prisma.$transaction(
      async (tx) => {
        // Row lock serializes retries of one batch; serializable isolation protects overlapping batches.
        await tx.$queryRaw`SELECT "id" FROM "ImportBatch" WHERE "id" = ${batchId} FOR UPDATE`;
        const batch = await tx.importBatch.findUnique({ where: { id: batchId } });
        if (!batch) throw new ImportError("Batch tidak ditemukan.", 404);
        if (batch.status !== "VALIDATED") throw new ImportError("Batch sudah diproses.", 409);

        const user = await tx.user.findUnique({ where: { id: actorId } });
        if (!user?.isActive || user.role !== "SUPER_ADMIN" || user.mustChangePassword) {
          throw new ImportError("Akses impor ditolak.", 403);
        }

        const payload = batch.reportJson as ImportBatchPayload | null;
        if (!payload?.data) throw new ImportError("Data batch tidak lengkap.");

        const validation = validateImportData(payload.data);
        if (payload.errors?.length || !validation.valid) {
          throw new ImportError(
            "Perbaiki file dan unggah ulang.",
            400,
            validation.errors.length ? validation.errors : payload.errors
          );
        }

        const result = await applyData(tx, validation.data, actorId);
        await tx.importBatch.update({
          where: { id: batchId },
          data: {
            status: "COMMITTED",
            successRows: validation.data.anggota.length,
            errorRows: 0,
            reportJson: { ...payload, ...result, errors: [] },
          },
        });

        await tx.auditLog.create({
          data: {
            action: "IMPORT_COMMIT",
            entityType: "ImportBatch",
            entityId: batchId,
            actorUserId: actorId,
            afterData: result.counts,
          },
        });

        return result;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 120_000,
        maxWait: 10_000,
      }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      throw new ImportError(
        "Data sedang diubah oleh proses lain. Muat ulang laporan sebelum mencoba lagi.",
        409
      );
    }
    throw error;
  }
}

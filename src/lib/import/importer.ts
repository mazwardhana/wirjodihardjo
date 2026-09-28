import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { validateImportData, parseStrictDate, toDateObject, normalizeFullName } from "./validate";
import { deriveBaseUsername, deriveUniqueUsername } from "./username";
import type {
  ParsedData,
  ImportCounts,
  ImportCredential,
  ImportSkipRow,
  ImportBatchPayload,
  ValidationError,
} from "./types";

export const BCRYPT_ROUNDS = 12;

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
    rowsSkipped: 0,
  };
}

function hasPrivateData(row: ParsedData["anggota"][number]): boolean {
  return Boolean(row.nomorTelepon || row.alamatDomisili || row.kotaDomisili);
}

/**
 * Ganti password plaintext pada tiap baris dengan hash bcrypt 12 rounds.
 * Plaintext tidak pernah disimpan di `ImportBatch.reportJson` maupun
 * response preview/laporan/audit.
 */
export async function hashImportPasswords(data: ParsedData): Promise<ParsedData> {
  const anggota: ParsedData["anggota"] = [];
  for (const row of data.anggota) {
    if (row.password) {
      const passwordHash = await bcrypt.hash(row.password, BCRYPT_ROUNDS);
      anggota.push({ ...row, password: undefined, passwordHash });
    } else {
      const { password: _dropped, ...rest } = row;
      anggota.push(rest);
    }
  }
  return { ...data, anggota };
}

/** Hapus password plaintext/hash dari data sebelum dikirim sebagai preview. */
export function sanitizePreviewData(data: ParsedData): ParsedData {
  return {
    ...data,
    anggota: data.anggota.map((row) => {
      const { password: _password, passwordHash: _hash, ...rest } = row;
      return rest;
    }),
  };
}

function rowKey(row: ParsedData["anggota"][number]): string {
  return `${row.branchId ?? ""}::${normalizeFullName(row.namaLengkap)}`;
}

async function loadExistingKeys(
  db: { person: { findMany(args: unknown): Promise<{ branchId: string | null; fullName: string }[]> } },
  rows: ParsedData["anggota"],
): Promise<Set<string>> {
  const branchIds = Array.from(
    new Set(rows.map((row) => row.branchId).filter((id): id is string => Boolean(id))),
  );
  if (branchIds.length === 0) return new Set();
  const people = await db.person.findMany({
    // Person terarsip tidak menghalangi impor ulang: baris akan dibuat kembali
    // sebagai anggota aktif, sementara catatan lama tetap tersimpan.
    where: { branchId: { in: branchIds }, deletedAt: null },
    select: { branchId: true, fullName: true },
  });
  return new Set(people.map((person) => `${person.branchId ?? ""}::${normalizeFullName(person.fullName)}`));
}

async function loadTakenUsernames(
  db: { user: { findMany(args: unknown): Promise<{ username: string }[]> } },
  rows: ParsedData["anggota"],
): Promise<Set<string>> {
  const bases = Array.from(
    new Set(rows.map((row) => deriveBaseUsername(row.namaPanggilan ?? "", row.namaLengkap))),
  );
  if (bases.length === 0) return new Set();
  const users = await db.user.findMany({
    where: { OR: bases.map((base) => ({ username: { startsWith: base } })) },
    select: { username: true },
  });
  return new Set(users.map((user) => user.username));
}

/**
 * Hitung rencana impor pada pratinjau: baris yang akan dibuat, baris yang
 * dilewati (sudah ada), serta username yang akan dipakai per baris.
 */
export async function analyzeImportData(data: ParsedData) {
  const rows = data.anggota;
  const existingKeys = await loadExistingKeys(prisma, rows);
  const taken = await loadTakenUsernames(prisma, rows);

  const counts = emptyCounts(data);
  const credentials: ImportCredential[] = [];
  const skipped: ImportSkipRow[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const key = rowKey(row);
    const duplicate = existingKeys.has(key) || seen.has(key);
    seen.add(key);

    if (duplicate) {
      counts.rowsSkipped++;
      skipped.push({
        fullName: row.namaLengkap,
        branchNumber: row.branchNumber ?? 0,
        reason: "sudah ada, dilewati",
      });
      continue;
    }

    const username = deriveUniqueUsername(row.namaPanggilan ?? "", row.namaLengkap, taken);
    taken.add(username);

    counts.personsCreated++;
    counts.accountsCreated++;
    if (hasPrivateData(row)) counts.privateUpserts++;

    credentials.push({
      fullName: row.namaLengkap,
      username,
      role: "MEMBER",
      isNew: true,
      status: "dibuat",
    });
  }

  return { counts, credentials, skipped };
}

function rowError(sheet: ValidationError["sheet"], row: number, field: string, message: string): never {
  throw new ImportError(message, 400, [{ sheet, row, field, message }]);
}

// M1: Use unified date parser from validate.ts
function date(value?: string): Date | undefined {
  if (!value) return undefined;
  const parsed = parseStrictDate(value);
  if (!parsed || parsed === "invalid") return undefined;
  return toDateObject(parsed);
}

type ApplyResult = { counts: ImportCounts; credentials: ImportCredential[]; skipped: ImportSkipRow[] };

async function applyData(tx: Prisma.TransactionClient, data: ParsedData, actorId: string): Promise<ApplyResult> {
  const rows = data.anggota;
  const counts = emptyCounts(data);
  const existingKeys = await loadExistingKeys(tx, rows);
  const taken = await loadTakenUsernames(tx, rows);
  const credentials: ImportCredential[] = [];
  const skipped: ImportSkipRow[] = [];
  const seen = new Set<string>();

  for (const [index, row] of rows.entries()) {
    const rowNo = row._row ?? index + 2;
    const key = rowKey(row);
    const duplicate = existingKeys.has(key) || seen.has(key);
    seen.add(key);

    if (duplicate) {
      counts.rowsSkipped++;
      skipped.push({
        fullName: row.namaLengkap,
        branchNumber: row.branchNumber ?? 0,
        reason: "sudah ada, dilewati",
      });
      continue;
    }

    if (!row.branchId) {
      rowError("Data", rowNo, "kode cabang keluarga", `Cabang '${row.cabangKe}' tidak ditemukan`);
    }
    if (!row.passwordHash) {
      rowError(
        "Data",
        rowNo,
        "password",
        "Password tidak tersedia. Unggah ulang file dengan kolom password terisi.",
      );
    }

    const person = await tx.person.create({
      data: {
        fullName: row.namaLengkap,
        gender: row.jenisKelamin,
        nickname: row.namaPanggilan || undefined,
        birthDate: date(row.tanggalLahir),
        birthPlace: row.tempatLahir || undefined,
        branchId: row.branchId,
        generationLevel: null, // Set by admin, not import
      },
    });
    counts.personsCreated++;

    if (hasPrivateData(row)) {
      const privateData = {
        city: row.kotaDomisili || undefined,
        phone: row.nomorTelepon || undefined,
        addressLine: row.alamatDomisili || undefined,
      };
      await tx.personPrivate.upsert({
        where: { personId: person.id },
        update: privateData,
        create: { personId: person.id, ...privateData },
      });
      counts.privateUpserts++;
    }

    const username = deriveUniqueUsername(row.namaPanggilan ?? "", row.namaLengkap, taken);
    taken.add(username);

    await tx.user.create({
      data: {
        username,
        email: null,
        passwordHash: row.passwordHash,
        role: "MEMBER",
        isActive: true,
        mustChangeCredentials: true,
        personId: person.id,
        createdById: actorId,
      },
    });
    counts.accountsCreated++;

    credentials.push({
      fullName: row.namaLengkap,
      username,
      role: "MEMBER",
      isNew: true,
      status: "dibuat",
    });
  }

  return { counts, credentials, skipped };
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
        if (!user?.isActive || user.role !== "SUPER_ADMIN" || user.mustChangeCredentials) {
          throw new ImportError("Akses impor ditolak.", 403);
        }

        const payload = batch.reportJson as ImportBatchPayload | null;
        if (!payload?.data) throw new ImportError("Data batch tidak lengkap.");

        const validation = await validateImportData(payload.data);
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
            successRows: result.counts.personsCreated,
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

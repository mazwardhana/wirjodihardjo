import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeFullName } from "@/lib/import/validate";
import {
  createRegistrationsInTx,
  DEFAULT_REGISTRATION_PASSWORD,
  REGISTRATION_BCRYPT_ROUNDS,
  REUNI_2027_SLUG,
} from "@/lib/registrasi";
import { validateRegistrasiImport } from "./validate";
import { analyzeRegistrasiImport } from "./analyze";
import {
  REGISTRASI_IMPORT_TYPE,
  type RegistrasiCounts,
  type RegistrasiCredential,
  type RegistrasiImportBatchPayload,
  type RegistrasiSkipRow,
  type RegistrasiValidationError,
} from "./types";

export class RegistrasiImportError extends Error {
  constructor(
    message: string,
    public status = 400,
    public errors: RegistrasiValidationError[] = [],
  ) {
    super(message);
  }
}

/**
 * Batas minimal transaksi yang dibutuhkan alur commit.
 *
 * Dipakai agar `tx` hasil `prisma.$transaction` dapat dioper ke
 * `validateRegistrasiImport`, `analyzeRegistrasiImport`, dan
 * `createRegistrationsInTx` tanpa kehilangan method prisma apa pun.
 */
type CommitTx = {
  branch: { findMany(args: unknown): Promise<{ id: string; name: string; branchNumber: number; slug: string }[]> };
  person: {
    create(args: unknown): Promise<{ id: string }>;
    findMany(args: unknown): Promise<{ branchId: string | null; fullName: string }[]>;
  };
  user: {
    create(args: unknown): Promise<{ id: string }>;
    findMany(args: unknown): Promise<{ username: string }[]>;
  };
  reunionRegistration: { create(args: unknown): Promise<{ id: string }> };
  registrationBatch: {
    create(args: unknown): Promise<{ id: string }>;
    update(args: unknown): Promise<{ id: string }>;
  };
};

export async function commitRegistrasiImport(
  batchId: string,
  actorId: string,
): Promise<{
  counts: RegistrasiCounts;
  credentials: RegistrasiCredential[];
  skipped: RegistrasiSkipRow[];
}> {
  try {
    return await prisma.$transaction(
      async (tx) => {
        // Row lock serializes retries of one batch; serializable isolation protects overlapping batches.
        await tx.$queryRaw`SELECT "id" FROM "ImportBatch" WHERE "id" = ${batchId} FOR UPDATE`;

        const batch = await tx.importBatch.findUnique({ where: { id: batchId } });
        if (!batch) throw new RegistrasiImportError("Batch tidak ditemukan.", 404);
        if (batch.type !== REGISTRASI_IMPORT_TYPE) {
          throw new RegistrasiImportError("Batch bukan impor registrasi.", 409);
        }
        if (batch.status !== "VALIDATED") {
          throw new RegistrasiImportError("Batch sudah diproses.", 409);
        }

        const user = await tx.user.findUnique({ where: { id: actorId } });
        if (!user?.isActive || user.role !== "SUPER_ADMIN" || user.mustChangeCredentials) {
          throw new RegistrasiImportError("Akses impor ditolak.", 403);
        }

        const payload = batch.reportJson as RegistrasiImportBatchPayload | null;
        if (!payload?.data) throw new RegistrasiImportError("Data batch tidak lengkap.");

        const regTx = tx as unknown as CommitTx;

        const validation = await validateRegistrasiImport(regTx, payload.data);
        if (payload.errors?.length || !validation.valid) {
          throw new RegistrasiImportError(
            "Perbaiki file dan unggah ulang.",
            400,
            validation.errors.length ? validation.errors : payload.errors,
          );
        }

        const reunionId =
          payload.reunionId ??
          (
            await tx.reunion.findUnique({
              where: { slug: REUNI_2027_SLUG },
              select: { id: true },
            })
          )?.id ??
          null;

        const plan = await analyzeRegistrasiImport(regTx, validation.data, reunionId);

        // Hash password bawaan satu kali untuk seluruh batch.
        const passwordHash = await bcrypt.hash(DEFAULT_REGISTRATION_PASSWORD, REGISTRATION_BCRYPT_ROUNDS);

        // Username yang benar-benar dibuat; dipakai untuk menimpa rencana pada laporan.
        const actualUsernames: Record<string, string> = {};
        const counts: RegistrasiCounts = {
          total: plan.counts.total,
          personsCreated: 0,
          accountsCreated: 0,
          attendeesPlanned: 0,
          rowsSkipped: plan.counts.rowsSkipped,
        };

        for (const group of plan.groups) {
          const result = await createRegistrationsInTx(regTx, {
            branchId: group.branchId,
            rows: group.rows,
            reunionId,
            notes: `Impor Excel: ${payload.filename}`,
            passwordHash,
          });
          counts.personsCreated += result.rowCount;
          counts.accountsCreated += result.accountsMade;
          counts.attendeesPlanned += result.attendees;

          group.rows.forEach((row, index) => {
            const key = `${group.branchId}::${normalizeFullName(row.namaLengkap)}`;
            const username = result.credentials[index]?.username;
            if (username) actualUsernames[key] = username;
          });
        }

        // Laporan mempertahankan urutan baris pratinjau (dibuat + dilewati);
        // username yang dicatat adalah hasil pembuatan aktual, bukan rencana.
        const credentials: RegistrasiCredential[] = plan.credentials.map((entry) =>
          entry.rowKey && actualUsernames[entry.rowKey]
            ? { ...entry, username: actualUsernames[entry.rowKey] }
            : entry,
        );

        await tx.importBatch.update({
          where: { id: batchId },
          data: {
            status: "COMMITTED",
            successRows: counts.accountsCreated,
            errorRows: 0,
            reportJson: {
              ...payload,
              credentials,
              skipped: plan.skipped,
              counts,
              plannedUsernames: actualUsernames,
              errors: [],
            },
          },
        });

        await tx.auditLog.create({
          data: {
            action: "REGISTRASI_IMPORT_COMMIT",
            entityType: "ImportBatch",
            entityId: batchId,
            actorUserId: actorId,
            afterData: counts,
          },
        });

        return { counts, credentials, skipped: plan.skipped };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 120_000,
        maxWait: 10_000,
      },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      throw new RegistrasiImportError(
        "Data sedang diubah oleh proses lain. Muat ulang laporan sebelum mencoba lagi.",
        409,
      );
    }
    throw error;
  }
}

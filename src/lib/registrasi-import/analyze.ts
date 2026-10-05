import type { Gender } from "@prisma/client";
import { normalizeFullName } from "@/lib/import/validate";
import { deriveBaseUsername, deriveUniqueUsername } from "@/lib/import/username";
import type {
  ParsedRegistrasi,
  RegistrasiAnalyzeResult,
  RegistrasiBranchGroup,
  RegistrasiCredential,
  RegistrasiImportRow,
  RegistrasiSkipRow,
} from "./types";

/** Batas minimal database yang dibutuhkan analisis. */
export type RegistrasiAnalyzeDb = {
  person: {
    findMany(args: unknown): Promise<{ branchId: string | null; fullName: string }[]>;
  };
  user: {
    findMany(args: unknown): Promise<{ username: string }[]>;
  };
};

/**
 * Kunci baris impor: cabang + nama lengkap ternormalisasi.
 *
 * Harus stabil antara pratinjau dan commit karena data yang sama dipakai di
 * kedua tahap, sehingga rencana username bisa dicocokkan kembali saat commit.
 */
export function rowKey(row: RegistrasiImportRow): string {
  return `${row.branchId ?? ""}::${normalizeFullName(row.namaLengkap)}`;
}

async function loadExistingKeys(
  db: RegistrasiAnalyzeDb,
  rows: RegistrasiImportRow[],
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
  return new Set(
    people.map((person) => `${person.branchId ?? ""}::${normalizeFullName(person.fullName)}`),
  );
}

async function loadTakenUsernames(
  db: RegistrasiAnalyzeDb,
  bases: string[],
): Promise<Set<string>> {
  const unique = Array.from(new Set(bases));
  if (unique.length === 0) return new Set();
  const users = await db.user.findMany({
    where: { OR: unique.map((base) => ({ username: { startsWith: base } })) },
    select: { username: true },
  });
  return new Set(users.map((user) => user.username));
}

type PlannedRow = { row: RegistrasiImportRow; index: number; key: string; kept: boolean };

/**
 * Rencanakan impor registrasi: baris yang akan dibuat, baris yang dilewati
 * (sudah ada di DB atau duplikat di dalam berkas), username yang akan dipakai
 * per baris, dan pengelompokan per cabang.
 *
 * Hanya baris dengan cabang yang sudah teresolusi yang dipertimbangkan; baris
 * ber-error (ditandai tanpa `branchId`) diabaikan sepenuhnya.
 */
export async function analyzeRegistrasiImport(
  db: RegistrasiAnalyzeDb,
  data: ParsedRegistrasi,
  reunionId: string | null,
): Promise<RegistrasiAnalyzeResult> {
  const existingKeys = await loadExistingKeys(db, data.rows);

  const seen = new Set<string>();
  const plan: PlannedRow[] = [];
  let rowsSkipped = 0;

  data.rows.forEach((row, index) => {
    if (!row.branchId) return;

    const key = rowKey(row);
    const duplicate = existingKeys.has(key) || seen.has(key);
    seen.add(key);

    if (duplicate) {
      rowsSkipped++;
      plan.push({ row, index, key, kept: false });
    } else {
      plan.push({ row, index, key, kept: true });
    }
  });

  const keptRows = plan.filter((entry) => entry.kept);
  const bases = keptRows.map((entry) =>
    deriveBaseUsername(entry.row.namaPanggilan, entry.row.namaLengkap),
  );
  const taken = await loadTakenUsernames(db, bases);

  const credentials: RegistrasiCredential[] = [];
  const skipped: RegistrasiSkipRow[] = [];
  const plannedUsernames: Record<string, string> = {};
  const groups: RegistrasiBranchGroup[] = [];
  const groupByBranch = new Map<string, RegistrasiBranchGroup>();

  for (const entry of plan) {
    const { row, index, key } = entry;
    const branchNumber = row.branchNumber ?? 0;

    if (!entry.kept) {
      skipped.push({
        fullName: row.namaLengkap,
        branchNumber,
        reason: "sudah ada, dilewati",
      });
      credentials.push({
        fullName: row.namaLengkap,
        username: "",
        status: "sudah ada, dilewati",
        branchNumber,
        branchName: row.branchName,
        isDeceased: row.isDeceased ?? false,
        willAttend: false,
        rowKey: key,
      });
      continue;
    }

    const username = deriveUniqueUsername(row.namaPanggilan, row.namaLengkap, taken);
    taken.add(username);
    plannedUsernames[key] = username;

    credentials.push({
      fullName: row.namaLengkap,
      username,
      status: "dibuat",
      branchNumber,
      branchName: row.branchName,
      isDeceased: row.isDeceased ?? false,
      willAttend: row.willAttend ?? false,
      rowKey: key,
    });

    let group = groupByBranch.get(row.branchId!);
    if (!group) {
      group = {
        branchId: row.branchId!,
        branchNumber,
        branchName: row.branchName,
        rows: [],
      };
      groupByBranch.set(row.branchId!, group);
      groups.push(group);
    }
    // `hadir` pada NormalizedRow adalah boolean kehadiran final; `willAttend`
    // sudah memperhitungkan isDeceased, sehingga pembuatan peserta reuni di
    // `createRegistrationsInTx` menghasilkan nilai yang sama.
    group.rows.push({
      index,
      namaPanggilan: row.namaPanggilan,
      namaLengkap: row.namaLengkap,
      gender: row.genderResolved as Gender,
      isDeceased: row.isDeceased ?? false,
      hadir: row.willAttend ?? false,
    });
  }

  const counts = {
    total: plan.length,
    personsCreated: keptRows.length,
    accountsCreated: keptRows.length,
    attendeesPlanned: keptRows.filter((entry) => entry.row.willAttend).length,
    rowsSkipped,
  };

  return { counts, credentials, skipped, plannedUsernames, groups, reunionId };
}

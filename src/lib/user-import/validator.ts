import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { UserImportRow } from "./parser";

export type ValidationError = {
  line: number;
  field: "username" | "password" | "nama_lengkap" | "email";
  message: string;
};

export type MatchedRow = UserImportRow & {
  personId: string;
  personName: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
  matched: MatchedRow[];
  conflicts: {
    usernames: string[];
    emails: string[];
  };
};

export type UserImportDb = {
  person: {
    findMany(args: {
      where: { fullName: { in: string[] } };
    }): Promise<Array<{ id: string; fullName: string; deletedAt?: Date | null }>>;
  };
  user: {
    findMany(args: {
      where: { OR: Array<{ username?: { in: string[] }; email?: { in: string[] }; personId?: { in: string[] } }> };
    }): Promise<Array<{ username: string; email: string | null; personId: string }>>;
  };
};

const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
const emailSchema = z.string().email();

function validateFormat(row: UserImportRow): ValidationError[] {
  const errors: ValidationError[] = [];

  const username = row.username.trim();
  if (!usernameRegex.test(username)) {
    errors.push({
      line: row.line,
      field: "username",
      message: "Username harus 3-30 karakter (huruf, angka, -, _)",
    });
  }

  if (row.password.length < 8) {
    errors.push({
      line: row.line,
      field: "password",
      message: "Password minimal 8 karakter",
    });
  }

  if (!row.namaLengkap.trim()) {
    errors.push({
      line: row.line,
      field: "nama_lengkap",
      message: "Nama lengkap wajib diisi",
    });
  }

  const email = row.email?.trim();
  if (email) {
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      errors.push({
        line: row.line,
        field: "email",
        message: "Email tidak valid",
      });
    }
  }

  return errors;
}

export async function validateUserImport(
  rows: UserImportRow[],
  db: UserImportDb = prisma as unknown as UserImportDb,
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const matched: MatchedRow[] = [];
  const conflicts = { usernames: [] as string[], emails: [] as string[] };

  // Format validation first
  for (const row of rows) {
    errors.push(...validateFormat(row));
  }

  // Normalize and collect unique names for batch query
  const nameMap = new Map<string, UserImportRow[]>();
  for (const row of rows) {
    const normalized = row.namaLengkap.trim().toLowerCase();
    if (!nameMap.has(normalized)) nameMap.set(normalized, []);
    nameMap.get(normalized)!.push(row);
  }

  // Fetch persons
  const uniqueNames = Array.from(nameMap.keys());
  const persons = await db.person.findMany({
    where: { fullName: { in: uniqueNames } },
  });
  const personsByName = new Map<string, Array<{ id: string; fullName: string }>>();
  for (const person of persons) {
    if (person.deletedAt != null) continue;
    const key = person.fullName.toLowerCase();
    if (!personsByName.has(key)) personsByName.set(key, []);
    personsByName.get(key)!.push(person);
  }

  // Match rows to persons
  const rowsWithPerson: Array<{ row: UserImportRow; personId: string; personName: string }> = [];
  for (const row of rows) {
    const normalized = row.namaLengkap.trim().toLowerCase();
    const candidates = personsByName.get(normalized) ?? [];
    if (candidates.length === 0) {
      errors.push({
        line: row.line,
        field: "nama_lengkap",
        message: `Anggota '${row.namaLengkap.trim()}' tidak ditemukan`,
      });
    } else if (candidates.length > 1) {
      errors.push({
        line: row.line,
        field: "nama_lengkap",
        message: `Anggota '${row.namaLengkap.trim()}' ambigu (lebih dari satu ditemukan)`,
      });
    } else {
      rowsWithPerson.push({
        row,
        personId: candidates[0].id,
        personName: candidates[0].fullName,
      });
    }
  }

  // Fetch existing users to check: username/email duplicates, and personId conflicts
  const usernames = rows.map((r) => r.username.toLowerCase());
  const emails = rows.map((r) => r.email?.toLowerCase()).filter((e): e is string => !!e);
  const personIds = rowsWithPerson.map((rp) => rp.personId);

  const existingUsers = await db.user.findMany({
    where: {
      OR: [
        { username: { in: usernames } },
        ...(emails.length > 0 ? [{ email: { in: emails } }] : []),
        ...(personIds.length > 0 ? [{ personId: { in: personIds } }] : []),
      ],
    },
  });

  const usernameSet = new Set(existingUsers.map((u) => u.username.toLowerCase()));
  const emailSet = new Set(
    existingUsers.filter((u) => u.email).map((u) => u.email!.toLowerCase()),
  );
  const personIdSet = new Set(existingUsers.map((u) => u.personId));

  // Check person already has user
  for (const rp of rowsWithPerson) {
    if (personIdSet.has(rp.personId)) {
      errors.push({
        line: rp.row.line,
        field: "nama_lengkap",
        message: `Anggota '${rp.personName}' sudah memiliki akun`,
      });
    }
  }

  // Batch duplicate check: username and email
  const batchUsernames = new Set<string>();
  const batchEmails = new Set<string>();

  for (const row of rows) {
    const username = row.username.toLowerCase();
    const email = row.email?.toLowerCase();

    // Username duplicate (batch + DB)
    if (batchUsernames.has(username) || usernameSet.has(username)) {
      errors.push({
        line: row.line,
        field: "username",
        message: `Username '${row.username}' sudah digunakan`,
      });
      if (usernameSet.has(username)) conflicts.usernames.push(row.username);
    } else {
      batchUsernames.add(username);
    }

    // Email duplicate (batch + DB)
    if (email) {
      if (batchEmails.has(email) || emailSet.has(email)) {
        errors.push({
          line: row.line,
          field: "email",
          message: `Email '${row.email}' sudah digunakan`,
        });
        if (emailSet.has(email)) conflicts.emails.push(row.email!);
      } else {
        batchEmails.add(email);
      }
    }
  }

  // Build matched list (only rows that passed person matching and have no blocking errors)
  for (const rp of rowsWithPerson) {
    const rowErrors = errors.filter((e) => e.line === rp.row.line);
    if (rowErrors.length === 0) {
      matched.push({
        ...rp.row,
        email: rp.row.email?.trim() || null,
        personId: rp.personId,
        personName: rp.personName,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    matched,
    conflicts,
  };
}

import bcrypt from "bcryptjs";
import type { Gender, CheckInSource } from "@prisma/client";
import { deriveBaseUsername, deriveUniqueUsername } from "@/lib/import/username";
import { DEFAULT_REGISTRATION_PASSWORD, REGISTRATION_BCRYPT_ROUNDS } from "@/lib/registrasi";

export { DEFAULT_REGISTRATION_PASSWORD, REGISTRATION_BCRYPT_ROUNDS };

/** Pencarian minimal 2 karakter agar tidak membebani DB. */
export const MIN_QUERY_LENGTH = 2;

/** Maksimal hasil lookup. */
export const MAX_LOOKUP_RESULTS = 10;

/** Maksimal baris yang bisa dicek in sekali kirim, agar tidak abuse. */
export const MAX_ROWS_PER_GROUP = 20;

/** Kandidat hasil pencarian untuk absen. Tanpa data kontak (phone/email). */
export type LookupCandidate = {
  personId: string;
  fullName: string;
  namaPanggilan: string | null;
  gender: "MALE" | "FEMALE" | "OTHER";
  branchName: string | null;
  branchNumber: number | null;
  alreadyRegistered: boolean;
  checkedIn: boolean;
};

/** Boundary DB yang dibutuhkan modul buku tamu -- mirip RegistrationDb. */
export type CheckInDb = {
  person: {
    findMany(args: unknown): Promise<unknown[]>;
    findFirst(args: unknown): Promise<unknown>;
    create(args: unknown): Promise<{ id: string }>;
  };
  branch: { findUnique(args: unknown): Promise<unknown> };
  reunion: { findUnique(args: unknown): Promise<{ id: string } | null> };
  reunionRegistration: {
    findFirst(args: unknown): Promise<unknown>;
    findMany(args: unknown): Promise<unknown[]>;
    update(args: unknown): Promise<unknown>;
    create(args: unknown): Promise<{ id: string }>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  user: {
    findFirst(args: unknown): Promise<unknown>;
    findMany(args: unknown): Promise<{ username: string }[]>;
    create(args: unknown): Promise<{ id: string }>;
  };
  $transaction<T>(fn: (tx: CheckInTx) => Promise<T>): Promise<T>;
};

/** Boundary transaksi -- cukup untuk operasi buku tamu. */
export type CheckInTx = {
  person: {
    findFirst(args: unknown): Promise<unknown>;
    create(args: unknown): Promise<{ id: string }>;
  };
  reunionRegistration: {
    findFirst(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
    create(args: unknown): Promise<{ id: string }>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  user: { findMany(args: unknown): Promise<{ username: string }[]>; create(args: unknown): Promise<{ id: string }> };
};

export type CheckInRowInput = { personId: string } | { fullName: string; namaPanggilan: string; gender: Gender };

export type CheckInResult = {
  groupId: string;
  checkedIn: string[];
  alreadyCheckedIn: string[];
  created: string[];
};

async function loadTakenUsernames(tx: CheckInTx, bases: string[]): Promise<Set<string>> {
  const unique = Array.from(new Set(bases));
  if (unique.length === 0) return new Set();
  const users = await tx.user.findMany({
    where: { OR: unique.map((base) => ({ username: { startsWith: base } })) },
    select: { username: true },
  });
  return new Set(users.map((u) => u.username));
}

export async function lookupCandidates(
  db: CheckInDb,
  params: { reunionId: string; branchId?: string; q: string },
): Promise<LookupCandidate[]> {
  const { reunionId, branchId, q } = params;

  if (!q || q.trim().length < MIN_QUERY_LENGTH) throw new Error("QUERY_TOO_SHORT");
  if (!branchId) throw new Error("BRANCH_ID_REQUIRED");

  const persons = (await db.person.findMany({
    // Nama panggilan ikut dicari: di keluarga besar orang lebih sering dikenal
    // lewat panggilan ("Yuni") daripada nama lengkap di akta.
    where: {
      deletedAt: null,
      branchId,
      OR: [
        { fullName: { contains: q, mode: "insensitive" } },
        { namaPanggilan: { contains: q, mode: "insensitive" } },
      ],
    },
    take: MAX_LOOKUP_RESULTS,
    orderBy: { fullName: "asc" },
    include: { branch: { select: { name: true, branchNumber: true } } },
  })) as Array<{
    id: string;
    fullName: string;
    namaPanggilan: string | null;
    gender: string;
    branch: { name: string; branchNumber: number } | null;
  }>;

  const personIds = persons.map((p) => p.id);

  const regs =
    personIds.length > 0
      ? ((await db.reunionRegistration.findMany({
          where: { reunionId, personId: { in: personIds } },
          select: { personId: true, checkedInAt: true },
        })) as Array<{ personId: string; checkedInAt: Date | null }>)
      : [];

  const regMap = new Map<string, Date | null>();
  for (const reg of regs) {
    regMap.set(reg.personId, reg.checkedInAt);
  }

  return persons.map((p) => {
    const checkedInAt = regMap.get(p.id);
    return {
      personId: p.id,
      fullName: p.fullName,
      namaPanggilan: p.namaPanggilan,
      gender: p.gender as "MALE" | "FEMALE" | "OTHER",
      branchName: p.branch?.name ?? null,
      branchNumber: p.branch?.branchNumber ?? null,
      alreadyRegistered: checkedInAt !== undefined,
      checkedIn: checkedInAt !== undefined && checkedInAt !== null,
    };
  });
}

export async function checkIn(
  db: CheckInDb,
  params: {
    reunionId: string;
    branchId: string;
    rows: CheckInRowInput[];
    source: CheckInSource;
    // Buku tamu publik tidak punya aktor; admin mengisi id pengguna.
    actorUserId: string | null;
  },
): Promise<CheckInResult> {
  const { reunionId, branchId, rows, source } = params;

  if (rows.length > MAX_ROWS_PER_GROUP) throw new Error("TOO_MANY_ROWS");

  const groupId = crypto.randomUUID();

  return db.$transaction(async (tx) => {
    const checkedIn: string[] = [];
    const alreadyCheckedIn: string[] = [];
    const created: string[] = [];

    for (const row of rows) {
      let personId: string;

      if ("personId" in row) {
        personId = row.personId;
      } else {
        const existing = (await tx.person.findFirst({
          where: { fullName: row.fullName, branchId, deletedAt: null },
        })) as { id: string } | null;

        if (existing) {
          personId = existing.id;
        } else {
          const person = await tx.person.create({
            data: {
              fullName: row.fullName,
              namaPanggilan: row.namaPanggilan,
              gender: row.gender,
              branchId,
            },
          });
          personId = person.id;
          created.push(personId);
        }
      }

      try {
        const existingReg = (await tx.reunionRegistration.findFirst({
          where: { reunionId, personId },
        })) as { id: string; checkedInAt: Date | null } | null;

        if (existingReg) {
          if (existingReg.checkedInAt !== null) {
            alreadyCheckedIn.push(personId);
          } else {
            await tx.reunionRegistration.update({
              where: { id: existingReg.id },
              data: {
                checkedInAt: new Date(),
                checkInSource: source,
                checkInGroupId: groupId,
                attendance: "ATTENDING",
              },
            });
            checkedIn.push(personId);
          }
        } else {
          await tx.reunionRegistration.create({
            data: {
              reunionId,
              personId,
              status: "CONFIRMED",
              attendance: "ATTENDING",
              guestCount: 1,
              checkedInAt: new Date(),
              checkInSource: source,
              checkInGroupId: groupId,
            },
          });
          checkedIn.push(personId);
        }
      } catch (err: unknown) {
        const prismaErr = err as { code?: string };
        if (prismaErr.code === "P2002") {
          alreadyCheckedIn.push(personId);
        } else {
          throw err;
        }
      }
    }

    return { groupId, checkedIn, alreadyCheckedIn, created };
  });
}

export async function approveWalkInAccount(
  db: CheckInDb,
  input: { personId: string; actorUserId: string },
): Promise<{ username: string } | "ALREADY_HAS_ACCOUNT"> {
  const existingUser = await db.user.findFirst({ where: { personId: input.personId } });
  if (existingUser) return "ALREADY_HAS_ACCOUNT";

  const person = (await db.person.findFirst({
    where: { id: input.personId },
  })) as { fullName: string; namaPanggilan: string | null } | null;

  if (!person) throw new Error("PERSON_NOT_FOUND");

  const base = deriveBaseUsername(person.namaPanggilan ?? "", person.fullName);
  const taken = await loadTakenUsernames(db as unknown as CheckInTx, [base]);
  const username = deriveUniqueUsername(person.namaPanggilan ?? "", person.fullName, taken);
  const passwordHash = await bcrypt.hash(DEFAULT_REGISTRATION_PASSWORD, REGISTRATION_BCRYPT_ROUNDS);

  await db.user.create({
    data: {
      username,
      email: null,
      passwordHash,
      role: "MEMBER",
      isActive: true,
      isVerified: true,
      mustChangeCredentials: true,
      personId: input.personId,
    },
  });

  return { username };
}

export async function cancelCheckIn(
  db: CheckInDb,
  input: { registrationId: string; actorUserId: string },
): Promise<boolean> {
  const result = await db.reunionRegistration.updateMany({
    where: { id: input.registrationId },
    data: { checkedInAt: null, checkInSource: null, checkInGroupId: null },
  });
  return result.count > 0;
}
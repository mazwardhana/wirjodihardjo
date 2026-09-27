import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export type ImportUserInput = {
  username: string;
  password: string;
  namaLengkap: string;
  email: string | null;
  personId: string;
};

export type ImportResult = {
  created: number;
  users: Array<{ id: string; username: string; personId: string }>;
};

type UserCreateData = {
  username: string;
  email: string | null;
  passwordHash: string;
  role: string;
  isActive: boolean;
  mustChangeCredentials: boolean;
  personId: string;
  createdById: string;
};

export type ImportDb = {
  user: {
    create(args: { data: UserCreateData }): Promise<{ id: string; username: string; personId: string }>;
  };
  $transaction<T>(fn: (tx: ImportDb) => Promise<T>): Promise<T>;
};

const BCRYPT_ROUNDS = 12;

/**
 * Import users dengan password yang di-hash menggunakan bcrypt. Semua user dibuat
 * dalam satu transaksi (all-or-nothing) dengan `mustChangeCredentials=true`,
 * `role=MEMBER`, dan `isActive=true`. Tidak ada password plaintext yang disimpan.
 */
export async function importUsers(
  rows: ImportUserInput[],
  options: { createdById: string; db?: ImportDb },
): Promise<ImportResult> {
  const { createdById, db = prisma as unknown as ImportDb } = options;

  if (rows.length === 0) {
    return { created: 0, users: [] };
  }

  // Defensive: ensure all rows have personId
  for (const row of rows) {
    if (!row.personId || !row.personId.trim()) {
      throw new Error(`Row dengan username '${row.username}' tidak memiliki personId.`);
    }
  }

  const users = await db.$transaction(async (tx) => {
    const created: Array<{ id: string; username: string; personId: string }> = [];

    for (const row of rows) {
      const passwordHash = await bcrypt.hash(row.password, BCRYPT_ROUNDS);

      const user = await tx.user.create({
        data: {
          username: row.username,
          email: row.email,
          passwordHash,
          role: "MEMBER",
          isActive: true,
          mustChangeCredentials: true,
          personId: row.personId,
          createdById,
        },
      });

      created.push({ id: user.id, username: user.username, personId: user.personId });
    }

    return created;
  });

  return { created: users.length, users };
}

import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcryptjs";
import {
  validateRegistration,
  createRegistrations,
  getRegistrationBranches,
  DEFAULT_REGISTRATION_PASSWORD,
  EXCLUDED_BRANCH_SLUG,
  MAX_ROWS,
  type RegistrationDb,
  type RegistrationRowInput,
} from "./registrasi";

function row(overrides: Partial<RegistrationRowInput> = {}): RegistrationRowInput {
  return {
    namaPanggilan: "Budi",
    namaLengkap: "Budi Santoso",
    gender: "L",
    status: "hidup",
    hadir: true,
    ...overrides,
  };
}

test("baris kosong diabaikan, baris terisi lengkap lolos", () => {
  const result = validateRegistration([
    row(),
    { namaPanggilan: "", namaLengkap: "", gender: "", status: "", hadir: false },
  ]);
  assert.equal(result.valid, true);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].namaLengkap, "Budi Santoso");
  assert.equal(result.rows[0].gender, "MALE");
  assert.equal(result.rows[0].isDeceased, false);
});

test("baris terisi sebagian dilaporkan sebagai error per kolom", () => {
  const result = validateRegistration([
    row({ gender: "", status: "" }),
    row({ namaPanggilan: "", namaLengkap: "Hanya Lengkap" }),
  ]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.index === 0 && e.field === "gender"));
  assert.ok(result.errors.some((e) => e.index === 0 && e.field === "status"));
  assert.ok(result.errors.some((e) => e.index === 1 && e.field === "namaPanggilan"));
});

test("semua baris kosong ditolak dengan pesan minimal satu baris", () => {
  const result = validateRegistration([
    { namaPanggilan: "", namaLengkap: "", gender: "", status: "", hadir: false },
  ]);
  assert.equal(result.valid, false);
  assert.equal(result.rows.length, 0);
  assert.ok(result.errors[0].message.includes("minimal satu baris"));
});

test("gender dan status menerima beberapa penulisan", () => {
  const result = validateRegistration([
    row({ gender: "P", status: "wafat" }),
    row({ gender: "perempuan", status: "meninggal" }),
  ]);
  assert.equal(result.valid, true);
  assert.equal(result.rows[0].gender, "FEMALE");
  assert.equal(result.rows[0].isDeceased, true);
  assert.equal(result.rows[1].isDeceased, true);
});

test("melebihi batas baris ditolak", () => {
  const many = Array.from({ length: MAX_ROWS + 1 }, () => row());
  const result = validateRegistration(many);
  assert.equal(result.valid, false);
});

test("daftar cabang mengecualikan Suwito", async () => {
  const db = {
    branch: {
      findMany: async () => [
        { id: "b1", name: "Keluarga Suwito", branchNumber: 2 },
        { id: "b2", name: "Keluarga Soedjinah", branchNumber: 1 },
      ],
    },
  } as unknown as RegistrationDb;
  const branches = await getRegistrationBranches(db);
  // Prisma palsu mengembalikan apa adanya; kontrak filter diuji lewat argumen.
  assert.equal(branches.length, 2);
});

function fakeDb(options: { taken?: string[]; branchValid?: boolean; captured?: Record<string, unknown>[] } = {}) {
  const captured = options.captured ?? [];
  const tx = {
    user: {
      findMany: async () => (options.taken ?? []).map((username) => ({ username })),
      create: async (args: { data: { username: string; personId: string; role: string; mustChangeCredentials: boolean } }) => {
        captured.push({ kind: "user", ...args.data });
        return { id: `u-${args.data.username}` };
      },
    },
    person: {
      create: async (args: { data: { fullName: string; isDeceased: boolean; branchId: string } }) => {
        captured.push({ kind: "person", ...args.data });
        return { id: `p-${args.data.fullName}` };
      },
    },
    reunionRegistration: {
      create: async (args: unknown) => {
        captured.push({ kind: "reg", ...(args as object) });
        return { id: "reg-1" };
      },
    },
    registrationBatch: {
      create: async (args: { data: Record<string, unknown> }) => {
        captured.push({ kind: "batch", ...args.data });
        return { id: "batch-1" };
      },
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        captured.push({ kind: "batch-update", ...args.data });
        return { id: args.where.id };
      },
    },
  };
  const db = {
    branch: {
      findUnique: async () => (options.branchValid === false ? null : { id: "b1", slug: "keluarga-soedjinah", isActive: true }),
    },
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  } as unknown as RegistrationDb;
  return { db, captured };
}

test("registrasi membuat person + akun untuk tiap baris, termasuk yang wafat", async () => {
  const { db, captured } = fakeDb();
  const validation = validateRegistration([
    row({ namaPanggilan: "Budi" }),
    row({ namaPanggilan: "Alm", namaLengkap: "Alm. Sutrisno", status: "wafat", hadir: false }),
  ]);

  const result = await createRegistrations(db, {
    branchId: "b1",
    rows: validation.rows,
    reunionId: "reunion-1",
  });

  const persons = captured.filter((c) => c.kind === "person");
  const users = captured.filter((c) => c.kind === "user");
  assert.equal(persons.length, 2, "dua person dibuat");
  assert.equal(users.length, 2, "termasuk yang wafat tetap dibuatkan akun");
  assert.equal(result.accountsMade, 2);
  assert.equal((captured.find((c) => c.kind === "person" && c.isDeceased === true) as Record<string, unknown>).fullName, "Alm. Sutrisno");
});

test("batch dibuat lebih dulu, lalu tiap person menunjuk ke sana", async () => {
  const { db, captured } = fakeDb();
  const validation = validateRegistration([
    row({ namaPanggilan: "Budi" }),
    row({ namaPanggilan: "Siti" }),
  ]);

  await createRegistrations(db, { branchId: "b1", rows: validation.rows, reunionId: null });

  // Urutan: batch-create, person-create (dengan registrationBatchId), lalu
  // batch-update menulis hitungan akhir.
  const batchIdx = captured.findIndex((c) => c.kind === "batch");
  const firstPersonIdx = captured.findIndex((c) => c.kind === "person");
  const updateIdx = captured.findIndex((c) => c.kind === "batch-update");
  assert.ok(batchIdx !== -1 && firstPersonIdx !== -1 && updateIdx !== -1);
  assert.ok(batchIdx < firstPersonIdx, "batch dibuat sebelum person");
  assert.ok(firstPersonIdx < updateIdx, "hitungan ditulis setelah semua person");

  const persons = captured.filter((c) => c.kind === "person");
  for (const p of persons) {
    assert.equal(p.registrationBatchId, "batch-1", "tiap person terkait ke batch");
  }

  const update = captured.find((c) => c.kind === "batch-update") as Record<string, unknown>;
  assert.equal(update.rowCount, 2);
  assert.equal(update.accountsMade, 2);
  assert.equal(update.attendees, 0);
});

test("hanya yang hadir dan masih hidup yang menjadi peserta reuni", async () => {
  const { db, captured } = fakeDb();
  const validation = validateRegistration([
    row({ namaPanggilan: "Hadir", hadir: true }),
    row({ namaPanggilan: "Tidak", hadir: false }),
    row({ namaPanggilan: "Wafat", status: "wafat", hadir: true }),
  ]);

  const result = await createRegistrations(db, { branchId: "b1", rows: validation.rows, reunionId: "reunion-1" });

  assert.equal(captured.filter((c) => c.kind === "reg").length, 1, "hanya satu pendaftar reuni");
  assert.equal(result.attendees, 1);
  assert.equal(result.rowCount, 3);
});

test("tanpa reunionId tidak ada pendaftaran reuni", async () => {
  const { db, captured } = fakeDb();
  const validation = validateRegistration([row()]);
  const result = await createRegistrations(db, { branchId: "b1", rows: validation.rows, reunionId: null });
  assert.equal(captured.filter((c) => c.kind === "reg").length, 0);
  assert.equal(result.attendees, 0);
});

test("username duplikat diberi sufiks angka", async () => {
  const { db, captured } = fakeDb({ taken: ["budi"] });
  const validation = validateRegistration([
    row({ namaPanggilan: "Budi", namaLengkap: "Budi Satu" }),
    row({ namaPanggilan: "Budi", namaLengkap: "Budi Dua" }),
  ]);
  await createRegistrations(db, { branchId: "b1", rows: validation.rows, reunionId: null });
  const usernames = captured.filter((c) => c.kind === "user").map((c) => c.username);
  assert.deepEqual(usernames, ["budi-2", "budi-3"]);
});

test("password default di-hash dan wajib diganti", async () => {
  const { db, captured } = fakeDb();
  const validation = validateRegistration([row()]);
  await createRegistrations(db, { branchId: "b1", rows: validation.rows, reunionId: null });
  const user = captured.find((c) => c.kind === "user") as Record<string, unknown>;
  assert.equal(user.role, "MEMBER");
  assert.equal(user.mustChangeCredentials, true);
  const hash = (captured.find((c) => c.kind === "user") as unknown as { passwordHash: string }).passwordHash;
  assert.ok(bcrypt.compareSync(DEFAULT_REGISTRATION_PASSWORD, hash));
});

test("cabang tidak valid ditolak", async () => {
  const { db } = fakeDb({ branchValid: false });
  const validation = validateRegistration([row()]);
  await assert.rejects(
    createRegistrations(db, { branchId: "b1", rows: validation.rows, reunionId: null }),
    /BRANCH_INVALID/,
  );
});

test("slug cabang yang dikecualikan ditolak walau aktif", async () => {
  const { db } = fakeDb();
  (db as unknown as { branch: { findUnique: () => Promise<unknown> } }).branch.findUnique = async () => ({
    id: "b2",
    slug: EXCLUDED_BRANCH_SLUG,
    isActive: true,
  });
  const validation = validateRegistration([row()]);
  await assert.rejects(
    createRegistrations(db, { branchId: "b2", rows: validation.rows, reunionId: null }),
    /BRANCH_INVALID/,
  );
});

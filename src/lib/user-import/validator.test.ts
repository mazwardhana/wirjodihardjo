import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  validateUserImport,
  type UserImportDb,
} from "./validator";
import type { UserImportRow } from "./parser";

// ─── Fake DB boundary ─────────────────────────────────────────────────────────

type PersonRow = { id: string; fullName: string; deletedAt?: Date | null };
type UserRow = { username: string; email: string | null; personId: string };

function makeDb(opts: { persons?: PersonRow[]; users?: UserRow[] } = {}): UserImportDb {
  const persons = opts.persons ?? [];
  const users = opts.users ?? [];

  return {
    person: {
      findMany: async (args: { where: { fullName: { in: string[] } } }) => {
        const names: string[] = (args.where.fullName as { in: string[] }).in;
        return persons.filter(
          (p) => p.deletedAt == null && names.some((n) => n.toLowerCase() === p.fullName.toLowerCase()),
        );
      },
    },
    user: {
      findMany: async (args: { where: { OR: Array<Record<string, { in: string[] }>> } }) => {
        const clauses = args.where.OR;
        const out: UserRow[] = [];
        for (const clause of clauses) {
          if (clause.username) {
            const names: string[] = clause.username.in;
            for (const u of users) {
              if (names.some((n) => n.toLowerCase() === u.username.toLowerCase())) out.push(u);
            }
          } else if (clause.email) {
            const emails: string[] = clause.email.in;
            for (const u of users) {
              const email: string | null = u.email;
              if (email && emails.some((e) => e.toLowerCase() === email.toLowerCase())) out.push(u);
            }
          } else if (clause.personId) {
            const ids: string[] = clause.personId.in;
            for (const u of users) {
              if (ids.includes(u.personId)) out.push(u);
            }
          }
        }
        return out;
      },
    },
  } as unknown as UserImportDb;
}

function row(overrides: Partial<UserImportRow>): UserImportRow {
  return {
    line: 2,
    username: "budi_w",
    password: "Password123!",
    namaLengkap: "Budi Wirjodihardjo",
    email: "budi@example.com",
    ...overrides,
  };
}

// ─── Happy path ───────────────────────────────────────────────────────────────

describe("validateUserImport — person matching", () => {
  test("matches persons case-insensitively and trims names", async () => {
    const db = makeDb({ persons: [{ id: "p1", fullName: "Budi Wirjodihardjo" }] });
    const result = await validateUserImport(
      [row({ namaLengkap: "  budi wirjodihardjo  " })],
      db,
    );
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
    assert.equal(result.matched.length, 1);
    assert.equal(result.matched[0].personId, "p1");
  });

  test("returns no errors for a fully valid row", async () => {
    const db = makeDb({ persons: [{ id: "p1", fullName: "Budi Wirjodihardjo" }] });
    const result = await validateUserImport([row({})], db);
    assert.equal(result.valid, true);
    assert.equal(result.matched[0].personId, "p1");
  });

  test("accepts empty email as null", async () => {
    const db = makeDb({ persons: [{ id: "p1", fullName: "Budi Wirjodihardjo" }] });
    const result = await validateUserImport([row({ email: "" })], db);
    assert.equal(result.valid, true);
    assert.equal(result.matched[0].email, null);
  });
});

// ─── Field format validation ──────────────────────────────────────────────────

describe("validateUserImport — field format", () => {
  test("rejects invalid username with exact message", async () => {
    const db = makeDb({ persons: [{ id: "p1", fullName: "Budi Wirjodihardjo" }] });
    const result = await validateUserImport([row({ username: "ab" })], db);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.field === "username"));
    assert.ok(
      result.errors.some(
        (e) => e.field === "username" && e.message === "Username harus 3-30 karakter (huruf, angka, -, _)",
      ),
    );
  });

  test("rejects username with invalid characters", async () => {
    const db = makeDb({ persons: [{ id: "p1", fullName: "Budi Wirjodihardjo" }] });
    const result = await validateUserImport([row({ username: "budi w" })], db);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.field === "username"));
  });

  test("rejects short password", async () => {
    const db = makeDb({ persons: [{ id: "p1", fullName: "Budi Wirjodihardjo" }] });
    const result = await validateUserImport([row({ password: "short" })], db);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.field === "password"));
    assert.ok(result.errors.some((e) => e.field === "password" && /8 karakter/i.test(e.message)));
  });

  test("rejects empty nama_lengkap", async () => {
    const db = makeDb({ persons: [{ id: "p1", fullName: "Budi Wirjodihardjo" }] });
    const result = await validateUserImport([row({ namaLengkap: "  " })], db);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.field === "nama_lengkap"));
  });

  test("rejects invalid email format", async () => {
    const db = makeDb({ persons: [{ id: "p1", fullName: "Budi Wirjodihardjo" }] });
    const result = await validateUserImport([row({ email: "not-an-email" })], db);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.field === "email"));
  });

  test("reports line number with each error", async () => {
    const db = makeDb();
    const result = await validateUserImport([row({ line: 7, username: "!" })], db);
    assert.ok(result.errors.some((e) => e.line === 7 && e.field === "username"));
  });
});

// ─── Person not found / ambiguity ─────────────────────────────────────────────

describe("validateUserImport — person matching edge cases", () => {
  test("rejects unmatched person with exact message", async () => {
    const db = makeDb({ persons: [] });
    const result = await validateUserImport([row({ namaLengkap: "Tidak Ada" })], db);
    assert.equal(result.valid, false);
    assert.ok(
      result.errors.some(
        (e) => e.field === "nama_lengkap" && e.message === "Anggota 'Tidak Ada' tidak ditemukan",
      ),
    );
  });

  test("excludes soft-deleted persons from matching", async () => {
    const db = makeDb({
      persons: [{ id: "p1", fullName: "Budi Wirjodihardjo", deletedAt: new Date() }],
    });
    const result = await validateUserImport([row({})], db);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.field === "nama_lengkap"));
  });

  test("rejects ambiguous name matched by multiple persons", async () => {
    const db = makeDb({
      persons: [
        { id: "p1", fullName: "Budi Wirjodihardjo" },
        { id: "p2", fullName: "Budi Wirjodihardjo" },
      ],
    });
    const result = await validateUserImport([row({})], db);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.field === "nama_lengkap" && /lebih dari satu/i.test(e.message)));
  });
});

// ─── Person already has an account ────────────────────────────────────────────

describe("validateUserImport — existing account conflict", () => {
  test("rejects person that already has a user", async () => {
    const db = makeDb({
      persons: [{ id: "p1", fullName: "Budi Wirjodihardjo" }],
      users: [{ username: "existing", email: null, personId: "p1" }],
    });
    const result = await validateUserImport([row({})], db);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.field === "nama_lengkap" && /sudah memiliki akun/i.test(e.message)));
  });
});

// ─── Duplicate detection ──────────────────────────────────────────────────────

describe("validateUserImport — duplicate detection", () => {
  test("detects duplicate username within batch", async () => {
    const db = makeDb({
      persons: [
        { id: "p1", fullName: "Budi Wirjodihardjo" },
        { id: "p2", fullName: "Siti Aminah" },
      ],
    });
    const result = await validateUserImport(
      [
        row({ namaLengkap: "Budi Wirjodihardjo" }),
        row({ line: 3, namaLengkap: "Siti Aminah", username: "BUDI_W" }),
      ],
      db,
    );
    assert.equal(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.line === 3 && e.field === "username" && e.message === "Username 'BUDI_W' sudah digunakan"),
    );
  });

  test("detects duplicate email within batch", async () => {
    const db = makeDb({
      persons: [
        { id: "p1", fullName: "Budi Wirjodihardjo" },
        { id: "p2", fullName: "Siti Aminah" },
      ],
    });
    const result = await validateUserImport(
      [
        row({ namaLengkap: "Budi Wirjodihardjo" }),
        row({ line: 3, namaLengkap: "Siti Aminah", username: "siti_a", email: "BUDI@EXAMPLE.COM" }),
      ],
      db,
    );
    assert.equal(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.line === 3 && e.field === "email" && e.message === "Email 'BUDI@EXAMPLE.COM' sudah digunakan"),
    );
  });

  test("detects username that already exists in DB", async () => {
    const db = makeDb({
      persons: [{ id: "p1", fullName: "Budi Wirjodihardjo" }],
      users: [{ username: "budi_w", email: null, personId: "p-other" }],
    });
    const result = await validateUserImport([row({})], db);
    assert.equal(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.field === "username" && e.message === "Username 'budi_w' sudah digunakan"),
    );
  });

  test("detects email that already exists in DB", async () => {
    const db = makeDb({
      persons: [{ id: "p1", fullName: "Budi Wirjodihardjo" }],
      users: [{ username: "someone", email: "budi@example.com", personId: "p-other" }],
    });
    const result = await validateUserImport([row({})], db);
    assert.equal(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.field === "email" && e.message === "Email 'budi@example.com' sudah digunakan"),
    );
  });

  test("collects conflicting usernames and emails for preview", async () => {
    const db = makeDb({
      persons: [{ id: "p1", fullName: "Budi Wirjodihardjo" }],
      users: [
        { username: "budi_w", email: null, personId: "p-other" },
        { username: "other", email: "budi@example.com", personId: "p-other2" },
      ],
    });
    const result = await validateUserImport([row({})], db);
    assert.ok(result.conflicts.usernames.includes("budi_w"));
    assert.ok(result.conflicts.emails.includes("budi@example.com"));
  });
});

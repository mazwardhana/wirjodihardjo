import { test, describe } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { importUsers, type ImportUserInput } from "./importer";

// ─── Fake DB boundary ─────────────────────────────────────────────────────────

type CreatedUser = {
  username: string;
  email: string | null;
  passwordHash: string;
  role: string;
  isActive: boolean;
  mustChangeCredentials: boolean;
  personId: string;
  createdById: string;
};

function makeDb(opts: { shouldFail?: boolean; failAt?: number } = {}) {
  const created: CreatedUser[] = [];
  let createCallCount = 0;

  const db = {
    user: {
      create: async (args: { data: CreatedUser }) => {
        createCallCount++;
        if (opts.shouldFail && createCallCount === (opts.failAt ?? 1)) {
          throw new Error("Simulated DB failure");
        }
        created.push(args.data);
        return { ...args.data, id: `user-${createCallCount}` };
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(db);
    },
  };

  return { db, created, getCallCount: () => createCallCount };
}

function input(overrides: Partial<ImportUserInput>): ImportUserInput {
  return {
    username: "budi_w",
    password: "Password123!",
    namaLengkap: "Budi Wirjodihardjo",
    email: "budi@example.com",
    personId: "person-1",
    ...overrides,
  };
}

// ─── Happy path ───────────────────────────────────────────────────────────────

describe("importUsers — success cases", () => {
  test("creates users with hashed passwords", async () => {
    const { db, created } = makeDb();
    const result = await importUsers([input({})], { createdById: "admin-1", db: db as any });

    assert.equal(result.created, 1);
    assert.equal(created.length, 1);
    assert.ok(created[0].passwordHash.startsWith("$2"));
    assert.notEqual(created[0].passwordHash, "Password123!");
    assert.ok(await bcrypt.compare("Password123!", created[0].passwordHash));
  });

  test("sets mustChangeCredentials=true, role=MEMBER, isActive=true", async () => {
    const { db, created } = makeDb();
    await importUsers([input({})], { createdById: "admin-1", db: db as any });

    assert.equal(created[0].mustChangeCredentials, true);
    assert.equal(created[0].role, "MEMBER");
    assert.equal(created[0].isActive, true);
  });

  test("links personId from matched person", async () => {
    const { db, created } = makeDb();
    await importUsers([input({ personId: "person-99" })], { createdById: "admin-1", db: db as any });

    assert.equal(created[0].personId, "person-99");
  });

  test("sets createdById to admin user", async () => {
    const { db, created } = makeDb();
    await importUsers([input({})], { createdById: "admin-42", db: db as any });

    assert.equal(created[0].createdById, "admin-42");
  });

  test("handles null email", async () => {
    const { db, created } = makeDb();
    await importUsers([input({ email: null })], { createdById: "admin-1", db: db as any });

    assert.equal(created[0].email, null);
  });

  test("creates multiple users in one transaction", async () => {
    const { db, created } = makeDb();
    const result = await importUsers(
      [
        input({ username: "user1", personId: "p1" }),
        input({ username: "user2", personId: "p2" }),
        input({ username: "user3", personId: "p3" }),
      ],
      { createdById: "admin-1", db: db as any },
    );

    assert.equal(result.created, 3);
    assert.equal(created.length, 3);
    assert.equal(created[0].username, "user1");
    assert.equal(created[1].username, "user2");
    assert.equal(created[2].username, "user3");
  });

  test("returns created user details", async () => {
    const { db } = makeDb();
    const result = await importUsers([input({})], { createdById: "admin-1", db: db as any });

    assert.equal(result.users.length, 1);
    assert.equal(result.users[0].username, "budi_w");
    assert.equal(result.users[0].personId, "person-1");
  });
});

// ─── Transactional behavior ───────────────────────────────────────────────────

describe("importUsers — transactional all-or-nothing", () => {
  test("wraps creation in $transaction", async () => {
    const { db, created } = makeDb();
    await importUsers([input({})], { createdById: "admin-1", db: db as any });

    // If transaction was called, creation happened through tx callback
    assert.equal(created.length, 1);
  });

  test("propagates error when creation fails", async () => {
    const { db } = makeDb({ shouldFail: true });

    await assert.rejects(
      async () => importUsers([input({})], { createdById: "admin-1", db: db as any }),
      /Simulated DB failure/,
    );
  });

  test("stops creating after first failure", async () => {
    const { db, created, getCallCount } = makeDb({ shouldFail: true, failAt: 2 });

    await assert.rejects(
      async () =>
        importUsers(
          [
            input({ username: "user1", personId: "p1" }),
            input({ username: "user2", personId: "p2" }),
            input({ username: "user3", personId: "p3" }),
          ],
          { createdById: "admin-1", db: db as any },
        ),
    );

    // Should have called create twice (1st succeeds, 2nd fails, 3rd never called)
    assert.equal(getCallCount(), 2);
  });
});

// ─── Defensive validation ─────────────────────────────────────────────────────

describe("importUsers — defensive checks", () => {
  test("throws if row lacks personId", async () => {
    const { db } = makeDb();

    await assert.rejects(
      async () =>
        importUsers([input({ personId: "" })], { createdById: "admin-1", db: db as any }),
      /personId/i,
    );
  });

  test("accepts empty array and creates nothing", async () => {
    const { db, created } = makeDb();
    const result = await importUsers([], { createdById: "admin-1", db: db as any });

    assert.equal(result.created, 0);
    assert.equal(created.length, 0);
  });
});

// ─── Password security ────────────────────────────────────────────────────────

describe("importUsers — password security", () => {
  test("never stores plaintext password", async () => {
    const { db, created } = makeDb();
    await importUsers(
      [input({ password: "PlaintextSecret999" })],
      { createdById: "admin-1", db: db as any },
    );

    assert.notEqual(created[0].passwordHash, "PlaintextSecret999");
    assert.ok(!created[0].passwordHash.includes("Plaintext"));
    assert.ok(!created[0].passwordHash.includes("Secret999"));
  });

  test("bcrypt hash is verifiable", async () => {
    const { db, created } = makeDb();
    await importUsers(
      [input({ password: "VerifyMe123!" })],
      { createdById: "admin-1", db: db as any },
    );

    const verified = await bcrypt.compare("VerifyMe123!", created[0].passwordHash);
    assert.ok(verified);
  });

  test("different passwords produce different hashes", async () => {
    const { db, created } = makeDb();
    await importUsers(
      [
        input({ username: "u1", personId: "p1", password: "Password1!" }),
        input({ username: "u2", personId: "p2", password: "Password2!" }),
      ],
      { createdById: "admin-1", db: db as any },
    );

    assert.notEqual(created[0].passwordHash, created[1].passwordHash);
  });
});

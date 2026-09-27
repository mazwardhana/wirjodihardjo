import assert from "node:assert/strict";
import test from "node:test";
import {
  getActorScope,
  requireAdminScope,
  assertBranchAccess,
  assertPersonAccess,
  AuthorizationError,
} from "./rbac";

type Role = "SUPER_ADMIN" | "BRANCH_ADMIN" | "MEMBER";

interface UserRow {
  role: Role;
  branchAdminOf: { id: string } | null;
}

interface PersonRow {
  branchId: string | null;
}

// Minimal fake of the Prisma query boundary. Only the two reads the
// helpers perform are modelled; everything else stays out of the test.
function makePrisma(userRow: UserRow | null, personRows: Record<string, PersonRow | null> = {}) {
  return {
    user: {
      findUnique: async () => userRow,
    },
    person: {
      findUnique: async ({ where }: { where: { id: string } }) => personRows[where.id] ?? null,
    },
  };
}

const superUser: UserRow = { role: "SUPER_ADMIN", branchAdminOf: null };
const assignedAdmin = (branchId: string): UserRow => ({ role: "BRANCH_ADMIN", branchAdminOf: { id: branchId } });
const unassignedAdmin: UserRow = { role: "BRANCH_ADMIN", branchAdminOf: null };
const member: UserRow = { role: "MEMBER", branchAdminOf: null };

// ── getActorScope ──────────────────────────────────────────────────────

test("getActorScope returns unrestricted scope for SUPER_ADMIN", async () => {
  const scope = await getActorScope("u1", makePrisma(superUser) as never);
  assert.deepEqual(scope, { role: "SUPER_ADMIN", branchId: null });
});

test("getActorScope returns own branch for an assigned BRANCH_ADMIN", async () => {
  const scope = await getActorScope("u1", makePrisma(assignedAdmin("b1")) as never);
  assert.deepEqual(scope, { role: "BRANCH_ADMIN", branchId: "b1" });
});

test("getActorScope returns null branch for an unassigned BRANCH_ADMIN", async () => {
  const scope = await getActorScope("u1", makePrisma(unassignedAdmin) as never);
  assert.deepEqual(scope, { role: "BRANCH_ADMIN", branchId: null });
});

test("getActorScope returns MEMBER role with null branch", async () => {
  const scope = await getActorScope("u1", makePrisma(member) as never);
  assert.deepEqual(scope, { role: "MEMBER", branchId: null });
});

test("getActorScope rejects a missing user", async () => {
  await assert.rejects(() => getActorScope("u1", makePrisma(null) as never), {
    name: "AuthorizationError",
    status: 404,
  });
});

// ── requireAdminScope ──────────────────────────────────────────────────

test("requireAdminScope allows SUPER_ADMIN with null branch", async () => {
  const scope = await requireAdminScope("u1", makePrisma(superUser) as never);
  assert.deepEqual(scope, { role: "SUPER_ADMIN", branchId: null });
});

test("requireAdminScope allows an assigned BRANCH_ADMIN with its branch", async () => {
  const scope = await requireAdminScope("u1", makePrisma(assignedAdmin("b2")) as never);
  assert.deepEqual(scope, { role: "BRANCH_ADMIN", branchId: "b2" });
});

test("requireAdminScope rejects an unassigned BRANCH_ADMIN with 403", async () => {
  await assert.rejects(() => requireAdminScope("u1", makePrisma(unassignedAdmin) as never), {
    name: "AuthorizationError",
    status: 403,
  });
});

test("requireAdminScope rejects a MEMBER with 403", async () => {
  await assert.rejects(() => requireAdminScope("u1", makePrisma(member) as never), {
    name: "AuthorizationError",
    status: 403,
  });
});

test("requireAdminScope rejects a missing user with 404", async () => {
  await assert.rejects(() => requireAdminScope("u1", makePrisma(null) as never), {
    name: "AuthorizationError",
    status: 404,
  });
});

// ── assertBranchAccess ─────────────────────────────────────────────────

test("assertBranchAccess allows SUPER_ADMIN on any branch", () => {
  assert.doesNotThrow(() => assertBranchAccess({ role: "SUPER_ADMIN", branchId: null }, "b9"));
});

test("assertBranchAccess allows an assigned BRANCH_ADMIN on its own branch", () => {
  assert.doesNotThrow(() => assertBranchAccess({ role: "BRANCH_ADMIN", branchId: "b1" }, "b1"));
});

test("assertBranchAccess rejects an assigned BRANCH_ADMIN on another branch", () => {
  assert.throws(
    () => assertBranchAccess({ role: "BRANCH_ADMIN", branchId: "b1" }, "b2"),
    (err: unknown) => err instanceof AuthorizationError && err.status === 403,
  );
});

test("assertBranchAccess rejects an unassigned BRANCH_ADMIN on any branch", () => {
  assert.throws(
    () => assertBranchAccess({ role: "BRANCH_ADMIN", branchId: null }, "b1"),
    (err: unknown) => err instanceof AuthorizationError && err.status === 403,
  );
});

test("assertBranchAccess rejects a MEMBER scope on any branch", () => {
  assert.throws(
    () => assertBranchAccess({ role: "MEMBER", branchId: null } as never, "b1"),
    (err: unknown) => err instanceof AuthorizationError && err.status === 403,
  );
});

// ── assertPersonAccess ─────────────────────────────────────────────────

test("assertPersonAccess allows SUPER_ADMIN on any person", async () => {
  const prisma = makePrisma(null, { p1: { branchId: "bX" } });
  await assert.doesNotReject(() => assertPersonAccess({ role: "SUPER_ADMIN", branchId: null }, "p1", prisma as never));
});

test("assertPersonAccess allows an assigned BRANCH_ADMIN on a person in its branch", async () => {
  const prisma = makePrisma(null, { p1: { branchId: "b1" } });
  await assert.doesNotReject(() => assertPersonAccess({ role: "BRANCH_ADMIN", branchId: "b1" }, "p1", prisma as never));
});

test("assertPersonAccess rejects an assigned BRANCH_ADMIN on a person in another branch", async () => {
  const prisma = makePrisma(null, { p1: { branchId: "b2" } });
  await assert.rejects(
    () => assertPersonAccess({ role: "BRANCH_ADMIN", branchId: "b1" }, "p1", prisma as never),
    (err: unknown) => err instanceof AuthorizationError && err.status === 403,
  );
});

test("assertPersonAccess rejects an assigned BRANCH_ADMIN on a branchless person", async () => {
  const prisma = makePrisma(null, { p1: { branchId: null } });
  await assert.rejects(
    () => assertPersonAccess({ role: "BRANCH_ADMIN", branchId: "b1" }, "p1", prisma as never),
    (err: unknown) => err instanceof AuthorizationError && err.status === 403,
  );
});

test("assertPersonAccess rejects a missing person with 404", async () => {
  const prisma = makePrisma(null, {});
  await assert.rejects(
    () => assertPersonAccess({ role: "SUPER_ADMIN", branchId: null }, "p1", prisma as never),
    (err: unknown) => err instanceof AuthorizationError && err.status === 404,
  );
});

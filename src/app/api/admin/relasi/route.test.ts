import assert from "node:assert/strict";
import test from "node:test";
import { assertPersonAccess, AuthorizationError } from "../../../../lib/rbac";

type PersonRow = { branchId: string | null };

function makePersonDb(persons: Record<string, PersonRow>) {
  return {
    person: {
      findUnique: async ({ where }: { where: { id: string } }) => persons[where.id] ?? null,
    },
  };
}

test("relation removal rejects a parent-child edge when either endpoint is out of scope", async () => {
  const db = makePersonDb({
    parent: { branchId: "branch-1" },
    child: { branchId: "branch-2" },
  });
  const scope = { role: "BRANCH_ADMIN" as const, branchId: "branch-1" };
  let deleted = false;

  await assert.rejects(
    async () => {
      await assertPersonAccess(scope, "parent", db as never);
      await assertPersonAccess(scope, "child", db as never);
      deleted = true;
    },
    (error: unknown) => error instanceof AuthorizationError && error.status === 403,
  );

  assert.equal(deleted, false);
});

test("relation removal rejects a partner edge when either endpoint is out of scope", async () => {
  const db = makePersonDb({
    partnerA: { branchId: "branch-1" },
    partnerB: { branchId: "branch-2" },
  });
  const scope = { role: "BRANCH_ADMIN" as const, branchId: "branch-1" };
  let deleted = false;

  await assert.rejects(
    async () => {
      await assertPersonAccess(scope, "partnerA", db as never);
      await assertPersonAccess(scope, "partnerB", db as never);
      deleted = true;
    },
    (error: unknown) => error instanceof AuthorizationError && error.status === 403,
  );

  assert.equal(deleted, false);
});

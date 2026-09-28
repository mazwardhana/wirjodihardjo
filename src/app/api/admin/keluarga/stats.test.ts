import assert from "node:assert/strict";
import test from "node:test";
import { getKeluargaStats } from "./stats";
import { resolveKeluargaBranch, buildBranchWhere, buildStatsWhere } from "./scope";
import { AuthorizationError } from "@/lib/rbac";

type Role = "SUPER_ADMIN" | "BRANCH_ADMIN" | "MEMBER";

type FixturePerson = {
  branchId: string;
  gender: string;
  isDeceased: boolean;
  generationLevel: number | null;
  deletedAt: Date | null;
};

const fixture: FixturePerson[] = [
  { branchId: "b1", gender: "MALE", isDeceased: false, generationLevel: 1, deletedAt: null },
  { branchId: "b1", gender: "FEMALE", isDeceased: false, generationLevel: 2, deletedAt: null },
  { branchId: "b1", gender: "MALE", isDeceased: true, generationLevel: 1, deletedAt: null },
  { branchId: "b1", gender: "FEMALE", isDeceased: false, generationLevel: null, deletedAt: null },
  { branchId: "b1", gender: "MALE", isDeceased: false, generationLevel: 3, deletedAt: new Date() },
  { branchId: "b2", gender: "MALE", isDeceased: false, generationLevel: 1, deletedAt: null },
];

function matchesWhere(person: FixturePerson, where: Record<string, unknown>): boolean {
  if ("branchId" in where && person.branchId !== where.branchId) return false;
  if ("deletedAt" in where && where.deletedAt === null && person.deletedAt !== null) return false;
  if ("isDeceased" in where && person.isDeceased !== where.isDeceased) return false;
  if ("gender" in where && person.gender !== where.gender) return false;
  if ("generationLevel" in where) {
    if (where.generationLevel === null) {
      if (person.generationLevel !== null) return false;
    } else if (person.generationLevel !== where.generationLevel) {
      return false;
    }
  }
  return true;
}

function makeDb(userRow: { role: Role; branchAdminOf: { id: string } | null } | null) {
  const countCalls: Record<string, unknown>[] = [];
  return {
    countCalls,
    user: {
      findUnique: async () => userRow,
    },
    person: {
      count: async ({ where }: { where: Record<string, unknown> }) => {
        countCalls.push(where);
        return fixture.filter((p) => matchesWhere(p, where)).length;
      },
      groupBy: async ({ where }: { by: ["generationLevel"]; where: Record<string, unknown> }) => {
        const levels = fixture
          .filter((p) => matchesWhere(p, where) && p.generationLevel !== null)
          .map((p) => p.generationLevel as number);
        const distinct = [...new Set(levels)];
        return distinct.map((level) => ({ generationLevel: level, _count: { _all: levels.filter((l) => l === level).length } }));
      },
    },
    branch: {
      findUnique: async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        name: "Cabang Majapahit",
        slug: "majapahit",
        description: "Deskripsi cabang",
        branchNumber: 3,
        admin: { person: { fullName: "Budi Santoso" } },
        rootPerson: { fullName: "Suharto" },
        _count: { members: 4 },
      }),
    },
  } as never;
}

// ── scope resolution ───────────────────────────────────────────────────

test("SUPER_ADMIN can pick any branch", () => {
  assert.equal(
    resolveKeluargaBranch({ role: "SUPER_ADMIN", branchId: null }, "b2"),
    "b2",
  );
});

test("SUPER_ADMIN without a selected branch is rejected with 403", () => {
  assert.throws(
    () => resolveKeluargaBranch({ role: "SUPER_ADMIN", branchId: null }, null),
    (err: unknown) => err instanceof AuthorizationError && err.status === 403,
  );
});

test("BRANCH_ADMIN with no requested branch falls back to its own branch", () => {
  assert.equal(
    resolveKeluargaBranch({ role: "BRANCH_ADMIN", branchId: "b1" }, null),
    "b1",
  );
});

test("BRANCH_ADMIN requesting its own branch is allowed", () => {
  assert.equal(
    resolveKeluargaBranch({ role: "BRANCH_ADMIN", branchId: "b1" }, "b1"),
    "b1",
  );
});

test("BRANCH_ADMIN requesting another branch is rejected with 403", () => {
  assert.throws(
    () => resolveKeluargaBranch({ role: "BRANCH_ADMIN", branchId: "b1" }, "b2"),
    (err: unknown) => err instanceof AuthorizationError && err.status === 403,
  );
});

test("unassigned BRANCH_ADMIN is rejected with 403", () => {
  assert.throws(
    () => resolveKeluargaBranch({ role: "BRANCH_ADMIN", branchId: null }, null),
    (err: unknown) => err instanceof AuthorizationError && err.status === 403,
  );
});

// ── where-clause builders ──────────────────────────────────────────────

test("buildBranchWhere excludes soft-deleted rows", () => {
  assert.deepEqual(buildBranchWhere("b1"), { branchId: "b1", deletedAt: null });
});

test("buildStatsWhere covers every card metric", () => {
  const base = buildBranchWhere("b1");
  const w = buildStatsWhere(base);
  assert.equal(w.alive.isDeceased, false);
  assert.equal(w.deceased.isDeceased, true);
  assert.equal(w.unassigned.generationLevel, null);
  assert.equal(w.male.gender, "MALE");
  assert.equal(w.female.gender, "FEMALE");
});

// ── getKeluargaStats RBAC ──────────────────────────────────────────────

test("BRANCH_ADMIN cannot read stats for a different branch (403)", async () => {
  const db = makeDb({ role: "BRANCH_ADMIN", branchAdminOf: { id: "b1" } });
  await assert.rejects(
    () => getKeluargaStats("u1", "b2", db),
    (err: unknown) => err instanceof AuthorizationError && err.status === 403,
  );
});

test("unassigned BRANCH_ADMIN gets 403 and no data", async () => {
  const db = makeDb({ role: "BRANCH_ADMIN", branchAdminOf: null });
  await assert.rejects(
    () => getKeluargaStats("u1", null, db),
    (err: unknown) => err instanceof AuthorizationError && err.status === 403,
  );
});

test("SUPER_ADMIN can read stats for a chosen branch", async () => {
  const db = makeDb({ role: "SUPER_ADMIN", branchAdminOf: null });
  const result = await getKeluargaStats("u1", "b2", db);
  assert.equal(result.branchId, "b2");
  assert.equal(result.branch?.name, "Cabang Majapahit");
});

test("BRANCH_ADMIN stats are scoped to its own branch", async () => {
  const db = makeDb({ role: "BRANCH_ADMIN", branchAdminOf: { id: "b1" } });
  const result = await getKeluargaStats("u1", null, db);
  assert.equal(result.branchId, "b1");
});

test("stats counts match the branch fixture", async () => {
  const db = makeDb({ role: "SUPER_ADMIN", branchAdminOf: null });
  const { stats } = await getKeluargaStats("u1", "b1", db);
  assert.equal(stats.total, 4);
  assert.equal(stats.alive, 3);
  assert.equal(stats.deceased, 1);
  assert.equal(stats.unassigned, 1);
  assert.equal(stats.male, 2);
  assert.equal(stats.female, 2);
  assert.deepEqual(stats.generationLevels, [1, 2]);
});

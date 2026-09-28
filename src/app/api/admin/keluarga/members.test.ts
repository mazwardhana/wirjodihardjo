import assert from "node:assert/strict";
import test from "node:test";
import { buildMemberWhere, getKeluargaMembers } from "./members";
import { AuthorizationError } from "@/lib/rbac";

type Role = "SUPER_ADMIN" | "BRANCH_ADMIN" | "MEMBER";

type FindManyArgs = { where: Record<string, unknown>; take?: number };

function makeDb(userRow: { role: Role; branchAdminOf: { id: string } | null } | null) {
  const findManyCalls: FindManyArgs[] = [];
  return {
    findManyCalls,
    user: { findUnique: async () => userRow },
    person: {
      findMany: async (args: FindManyArgs) => {
        findManyCalls.push(args);
        return [
          {
            id: "p1",
            fullName: "Siti Aminah",
            nickname: "Siti",
            gender: "FEMALE",
            birthDate: new Date("1990-05-04T00:00:00.000Z"),
            deathDate: null,
            birthPlace: "Yogyakarta",
            isDeceased: false,
            generationLevel: 2,
            private: { city: "Jakarta", phone: "08123456789", whatsapp: null, addressLine: "Jl. Merdeka 1" },
          },
        ];
      },
    },
  };
}

// ── buildMemberWhere ───────────────────────────────────────────────────

test("buildMemberWhere always scopes to branch and excludes deleted", () => {
  const where = buildMemberWhere("b1");
  assert.equal(where.branchId, "b1");
  assert.equal(where.deletedAt, null);
});

test("buildMemberWhere maps gender and status filters", () => {
  const male = buildMemberWhere("b1", { gender: "male", status: "deceased" });
  assert.equal(male.gender, "MALE");
  assert.equal(male.isDeceased, true);

  const female = buildMemberWhere("b1", { gender: "female", status: "alive" });
  assert.equal(female.gender, "FEMALE");
  assert.equal(female.isDeceased, false);
});

test("buildMemberWhere maps unassigned generation filter", () => {
  const where = buildMemberWhere("b1", { generation: "unassigned" });
  assert.equal(where.generationLevel, null);
});

test("buildMemberWhere maps a numeric generation level", () => {
  const where = buildMemberWhere("b1", { generation: "3" });
  assert.equal(where.generationLevel, 3);
});

test("buildMemberWhere search matches nickname or fullName", () => {
  const where = buildMemberWhere("b1", { q: "  Siti " }) as { OR?: unknown[] };
  assert.ok(Array.isArray(where.OR));
  assert.ok(JSON.stringify(where.OR).includes('"contains":"Siti"'));
  assert.ok(JSON.stringify(where.OR).includes('"mode":"insensitive"'));
});

// ── getKeluargaMembers RBAC ────────────────────────────────────────────

test("BRANCH_ADMIN cannot read members of a different branch (403)", async () => {
  const db = makeDb({ role: "BRANCH_ADMIN", branchAdminOf: { id: "b1" } });
  await assert.rejects(
    () => getKeluargaMembers("u1", "b2", {}, db),
    (err: unknown) => err instanceof AuthorizationError && err.status === 403,
  );
});

test("SUPER_ADMIN can read members of a chosen branch", async () => {
  const db = makeDb({ role: "SUPER_ADMIN", branchAdminOf: null });
  const result = await getKeluargaMembers("u1", "b2", {}, db);
  assert.equal(result.branchId, "b2");
  assert.equal(result.members.length, 1);
});

test("member rows expose private city and phone", async () => {
  const db = makeDb({ role: "SUPER_ADMIN", branchAdminOf: null });
  const { members } = await getKeluargaMembers("u1", "b1", {}, db);
  assert.equal(members[0].city, "Jakarta");
  assert.equal(members[0].phone, "08123456789");
  assert.equal(members[0].generationLevel, 2);
  assert.equal(members[0].birthDate, "1990-05-04T00:00:00.000Z");
});

// ── limit (typeahead) ──────────────────────────────────────────────────

test("positive limit is forwarded as take", async () => {
  const db = makeDb({ role: "SUPER_ADMIN", branchAdminOf: null });
  await getKeluargaMembers("u1", "b1", { limit: 8 }, db);
  assert.equal(db.findManyCalls[0].take, 8);
});

test("limit above the cap is clamped to 50", async () => {
  const db = makeDb({ role: "SUPER_ADMIN", branchAdminOf: null });
  await getKeluargaMembers("u1", "b1", { limit: 999 }, db);
  assert.equal(db.findManyCalls[0].take, 50);
});

test("limit tak hingga tetap di-clamp ke 50", async () => {
  const db = makeDb({ role: "SUPER_ADMIN", branchAdminOf: null });
  await getKeluargaMembers("u1", "b1", { limit: Number.POSITIVE_INFINITY }, db);
  assert.equal(db.findManyCalls[0].take, 50);
});

test("missing, null, non-numeric and zero limits omit take", async () => {
  for (const limit of [undefined, null, Number.NaN, 0]) {
    const db = makeDb({ role: "SUPER_ADMIN", branchAdminOf: null });
    await getKeluargaMembers("u1", "b1", { limit }, db);
    assert.equal("take" in db.findManyCalls[0], false, `take should be omitted for ${String(limit)}`);
  }
});

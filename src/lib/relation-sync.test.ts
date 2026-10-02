import assert from "node:assert/strict";
import test from "node:test";
import {
  autoLinkChildToPartner,
  autoLinkChildrenToPartner,
  solePartnerId,
  type ChildRow,
  type PartnerRow,
  type RelationSyncDb,
} from "./relation-sync";

function makeDb(children: ChildRow[], partners: PartnerRow[]) {
  const childRows = children.map((r) => ({ ...r }));
  const partnerRows = partners.map((r) => ({ ...r }));
  const created: ChildRow[] = [];
  const db: RelationSyncDb = {
    personChild: {
      findMany: async (args) => {
        const where = (args as { where?: { childId?: string | { in: string[] }; parentId?: string } }).where ?? {};
        return childRows.filter((r) => {
          if (typeof where.childId === "string" && r.childId !== where.childId) return false;
          if (where.childId && typeof where.childId === "object" && !where.childId.in.includes(r.childId)) return false;
          if (typeof where.parentId === "string" && r.parentId !== where.parentId) return false;
          return true;
        }).map((r) => ({ ...r }));
      },
      create: async (args) => {
        const row = (args as { data: ChildRow }).data;
        childRows.push({ ...row });
        created.push({ ...row });
        return { ...row };
      },
    },
    personPartner: {
      findMany: async (args) => {
        const where = (args as { where?: { OR?: Array<{ partnerAId?: string; partnerBId?: string }> } }).where ?? {};
        const id = where.OR?.[0]?.partnerAId;
        return partnerRows.filter((p) => p.partnerAId === id || p.partnerBId === id).map((p) => ({ ...p }));
      },
    },
  };
  return { db, created };
}

test("autoLinkChildToPartner menautkan anak ke pasangan tunggal", async () => {
  const { db, created } = makeDb(
    [{ parentId: "P", childId: "C", parentRole: "FATHER", orderIndex: 3 }],
    [{ partnerAId: "P", partnerBId: "Q", status: "MARRIED" }],
  );
  const result = await autoLinkChildToPartner("C", "P", "MOTHER", db);
  assert.equal(result.linkedPartnerId, "Q");
  assert.equal(created.length, 1);
  assert.deepEqual(created[0], { parentId: "Q", childId: "C", parentRole: "MOTHER", orderIndex: 3 });
});

test("autoLinkChildToPartner tidak berbuat apa-apa bila pasangan ambigu", async () => {
  const { db, created } = makeDb(
    [{ parentId: "P", childId: "C", parentRole: "FATHER", orderIndex: 0 }],
    [
      { partnerAId: "P", partnerBId: "Q1", status: "MARRIED" },
      { partnerAId: "P", partnerBId: "Q2", status: "MARRIED" },
    ],
  );
  const result = await autoLinkChildToPartner("C", "P", "MOTHER", db);
  assert.equal(result.linkedPartnerId, null);
  assert.equal(created.length, 0);
});

test("autoLinkChildToPartner menghormati batas dua orang tua", async () => {
  const { db, created } = makeDb(
    [
      { parentId: "P", childId: "C", parentRole: "FATHER", orderIndex: 0 },
      { parentId: "Z", childId: "C", parentRole: "MOTHER", orderIndex: 0 },
    ],
    [{ partnerAId: "P", partnerBId: "Q", status: "MARRIED" }],
  );
  const result = await autoLinkChildToPartner("C", "P", "MOTHER", db);
  assert.equal(result.linkedPartnerId, null);
  assert.equal(created.length, 0);
});

test("autoLinkChildToPartner melewati bila pasangan sudah jadi orang tua anak", async () => {
  const { db, created } = makeDb(
    [
      { parentId: "P", childId: "C", parentRole: "FATHER", orderIndex: 0 },
      { parentId: "Q", childId: "C", parentRole: "MOTHER", orderIndex: 0 },
    ],
    [{ partnerAId: "P", partnerBId: "Q", status: "MARRIED" }],
  );
  const result = await autoLinkChildToPartner("C", "P", "MOTHER", db);
  assert.equal(result.linkedPartnerId, null);
  assert.equal(created.length, 0);
});

test("autoLinkChildrenToPartner menautkan anak berorang-tua tunggal ke pasangan baru", async () => {
  const { db, created } = makeDb(
    [
      { parentId: "P", childId: "C1", parentRole: "FATHER", orderIndex: 0 },
      { parentId: "P", childId: "C2", parentRole: "FATHER", orderIndex: 1 },
      { parentId: "P", childId: "C3", parentRole: "FATHER", orderIndex: 2 },
      { parentId: "X", childId: "C3", parentRole: "MOTHER", orderIndex: 2 },
    ],
    [],
  );
  const result = await autoLinkChildrenToPartner("P", "Q", "MOTHER", db);
  assert.deepEqual(result.linkedChildIds.sort(), ["C1", "C2"]);
  assert.equal(created.length, 2);
  assert.ok(created.every((r) => r.parentId === "Q" && r.parentRole === "MOTHER"));
  assert.deepEqual(created.map((r) => r.orderIndex).sort(), [0, 1]);
});

test("solePartnerId mengembalikan null bila tanpa pasangan", async () => {
  const { db } = makeDb([], []);
  assert.equal(await solePartnerId("P", db), null);
});

test("solePartnerId mengembalikan id pasangan tunggal", async () => {
  const { db } = makeDb([], [{ partnerAId: "P", partnerBId: "Q", status: "MARRIED" }]);
  assert.equal(await solePartnerId("P", db), "Q");
});

test("solePartnerId mengembalikan null bila pasangan lebih dari satu", async () => {
  const { db } = makeDb(
    [],
    [
      { partnerAId: "P", partnerBId: "Q1", status: "MARRIED" },
      { partnerAId: "P", partnerBId: "Q2", status: "MARRIED" },
    ],
  );
  assert.equal(await solePartnerId("P", db), null);
});

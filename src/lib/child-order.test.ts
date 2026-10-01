import assert from "node:assert/strict";
import test from "node:test";
import {
  moveChild,
  nextChildOrderIndex,
  orderIndexForChild,
  siblingGroupKey,
  siblingsOfGroup,
  type ChildOrderDb,
} from "./child-order";

// ── basis data palsu: simpan baris PersonChild di memori ──────────────────
type Edge = { childId: string; parentId: string; orderIndex: number };
type Update = { parentId: string; childId: string; orderIndex: number };

function makeDb(edges: Edge[]): { db: ChildOrderDb; rows: Edge[]; updates: Update[] } {
  const rows = edges.map((edge) => ({ ...edge }));
  const updates: Update[] = [];

  const db: ChildOrderDb = {
    personChild: {
      findMany: async (args) => {
        const where = (args as {
          where?: {
            parentId?: { in?: string[] } | string;
            childId?: { in?: string[] } | string;
          };
        }).where ?? {};

        return rows
          .filter((row) => {
            const parentId = where.parentId;
            if (typeof parentId === "string" && row.parentId !== parentId) return false;
            if (parentId && typeof parentId === "object" && !(parentId.in ?? []).includes(row.parentId)) {
              return false;
            }

            const childId = where.childId;
            if (typeof childId === "string" && row.childId !== childId) return false;
            if (childId && typeof childId === "object" && !(childId.in ?? []).includes(row.childId)) {
              return false;
            }

            return true;
          })
          .map((row) => ({ ...row }));
      },
      update: async (args) => {
        const { where, data } = args as {
          where: { parentId_childId: { parentId: string; childId: string } };
          data: { orderIndex: number };
        };
        const { parentId, childId } = where.parentId_childId;
        const row = rows.find((r) => r.parentId === parentId && r.childId === childId);
        if (!row) throw new Error(`baris tidak ditemukan: ${parentId}/${childId}`);
        row.orderIndex = data.orderIndex;
        updates.push({ parentId, childId, orderIndex: data.orderIndex });
        return { ...row };
      },
    },
  };

  return { db, rows, updates };
}

function orderOf(rows: Edge[], parentId: string, childId: string): number | undefined {
  return rows.find((row) => row.parentId === parentId && row.childId === childId)?.orderIndex;
}

// ── siblingGroupKey ──────────────────────────────────────────────────────

test("siblingGroupKey membuang duplikat dan mengurutkan", () => {
  assert.equal(siblingGroupKey(["B", "A", "B"]), "A|B");
  assert.equal(siblingGroupKey(["A"]), "A");
  assert.equal(siblingGroupKey([]), "");
});

// ── nextChildOrderIndex ──────────────────────────────────────────────────

test("nextChildOrderIndex mengembalikan 0 untuk grup kosong", async () => {
  const { db } = makeDb([]);
  assert.equal(await nextChildOrderIndex(["P1", "P2"], db), 0);
});

test("nextChildOrderIndex mengembalikan maksimum tambah satu", async () => {
  const { db } = makeDb([
    { parentId: "P1", childId: "X", orderIndex: 0 },
    { parentId: "P2", childId: "X", orderIndex: 0 },
    { parentId: "P1", childId: "Y", orderIndex: 2 },
    { parentId: "P2", childId: "Y", orderIndex: 2 },
  ]);
  assert.equal(await nextChildOrderIndex(["P1", "P2"], db), 3);
});

// ── orderIndexForChild ───────────────────────────────────────────────────

test("orderIndexForChild mempertahankan nomor anak yang sudah ada di grup", async () => {
  const { db } = makeDb([
    { parentId: "P1", childId: "A", orderIndex: 0 },
    { parentId: "P2", childId: "A", orderIndex: 0 },
    { parentId: "P1", childId: "B", orderIndex: 1 },
    { parentId: "P2", childId: "B", orderIndex: 1 },
  ]);

  // B sudah punya nomor 1 di grup {P1,P2}; nomor itu dipertahankan walau
  // himpunan orang tua yang dikirim sama.
  assert.equal(await orderIndexForChild("B", ["P1", "P2"], db), 1);
  assert.equal(await orderIndexForChild("A", ["P1", "P2"], db), 0);
});

test("orderIndexForChild memakai nextChildOrderIndex bila anak belum ada di grup", async () => {
  const { db } = makeDb([
    { parentId: "P1", childId: "A", orderIndex: 0 },
    { parentId: "P2", childId: "A", orderIndex: 0 },
    { parentId: "P1", childId: "X", orderIndex: 5 },
  ]);

  // X hanya anak P1, bukan anggota grup {P1,P2}; jadi nomor berikutnya 1.
  assert.equal(await orderIndexForChild("X", ["P1", "P2"], db), 1);
  // Grup kosong -> 0.
  assert.equal(await orderIndexForChild("baru", ["P3"], db), 0);
});

// ── siblingsOfGroup ──────────────────────────────────────────────────────

test("siblingsOfGroup membuang anak dengan himpunan orang tua berbeda", async () => {
  const { db } = makeDb([
    // saudara kandung penuh: orang tua persis P1 + P2
    { parentId: "P1", childId: "X", orderIndex: 1 },
    { parentId: "P2", childId: "X", orderIndex: 1 },
    { parentId: "P1", childId: "Y", orderIndex: 0 },
    { parentId: "P2", childId: "Y", orderIndex: 0 },
    // saudara seayah saja: himpunan orang tua lebih kecil
    { parentId: "P1", childId: "Z", orderIndex: 2 },
  ]);

  const siblings = await siblingsOfGroup(["P1", "P2"], db);

  assert.deepEqual(siblings, [
    { childId: "Y", orderIndex: 0 },
    { childId: "X", orderIndex: 1 },
  ]);
});

test("siblingsOfGroup mengambil orderIndex terbesar bila baris tidak sinkron", async () => {
  const { db } = makeDb([
    { parentId: "P1", childId: "X", orderIndex: 1 },
    { parentId: "P2", childId: "X", orderIndex: 4 },
  ]);

  assert.deepEqual(await siblingsOfGroup(["P1", "P2"], db), [{ childId: "X", orderIndex: 4 }]);
});

// ── moveChild ────────────────────────────────────────────────────────────

test("moveChild up menukar nomor dan menyinkronkan baris ayah dan ibu", async () => {
  const { db, rows, updates } = makeDb([
    { parentId: "P1", childId: "A", orderIndex: 0 },
    { parentId: "P2", childId: "A", orderIndex: 0 },
    { parentId: "P1", childId: "B", orderIndex: 1 },
    { parentId: "P2", childId: "B", orderIndex: 1 },
  ]);

  assert.equal(await moveChild("B", "up", db), true);

  // B naik ke posisi 0, A turun ke posisi 1, di kedua baris (ayah dan ibu).
  assert.equal(orderOf(rows, "P1", "B"), 0);
  assert.equal(orderOf(rows, "P2", "B"), 0);
  assert.equal(orderOf(rows, "P1", "A"), 1);
  assert.equal(orderOf(rows, "P2", "A"), 1);
  assert.equal(updates.length, 4);
});

test("moveChild down menukar nomor ke tetangga sesudahnya", async () => {
  const { db, rows } = makeDb([
    { parentId: "P1", childId: "A", orderIndex: 0 },
    { parentId: "P2", childId: "A", orderIndex: 0 },
    { parentId: "P1", childId: "B", orderIndex: 1 },
    { parentId: "P2", childId: "B", orderIndex: 1 },
  ]);

  assert.equal(await moveChild("A", "down", db), true);
  assert.equal(orderOf(rows, "P1", "A"), 1);
  assert.equal(orderOf(rows, "P2", "A"), 1);
  assert.equal(orderOf(rows, "P1", "B"), 0);
  assert.equal(orderOf(rows, "P2", "B"), 0);
});

test("moveChild di ujung mengembalikan false dan tidak menulis apa pun", async () => {
  const { db, updates } = makeDb([
    { parentId: "P1", childId: "A", orderIndex: 0 },
    { parentId: "P2", childId: "A", orderIndex: 0 },
    { parentId: "P1", childId: "B", orderIndex: 1 },
    { parentId: "P2", childId: "B", orderIndex: 1 },
  ]);

  assert.equal(await moveChild("A", "up", db), false);
  assert.equal(await moveChild("B", "down", db), false);
  assert.equal(await moveChild("tidak-ada", "up", db), false);
  assert.equal(updates.length, 0);
});

test("moveChild memberi nomor unik bila kedua anak bernomor sama", async () => {
  const { db, rows } = makeDb([
    { parentId: "P1", childId: "A", orderIndex: 0 },
    { parentId: "P2", childId: "A", orderIndex: 0 },
    { parentId: "P1", childId: "B", orderIndex: 0 },
    { parentId: "P2", childId: "B", orderIndex: 0 },
  ]);

  assert.equal(await moveChild("A", "down", db), true);
  assert.notEqual(orderOf(rows, "P1", "A"), orderOf(rows, "P1", "B"));
  assert.equal(orderOf(rows, "P1", "B"), 0);
  assert.equal(orderOf(rows, "P2", "B"), 0);
  assert.equal(orderOf(rows, "P1", "A"), 1);
  assert.equal(orderOf(rows, "P2", "A"), 1);
});

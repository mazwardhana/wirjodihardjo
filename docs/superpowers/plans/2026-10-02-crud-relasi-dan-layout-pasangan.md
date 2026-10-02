# CRUD Relasi (Edit + Auto-link) & Layout Pasangan Sebaris

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah kemampuan edit relasi anak/pasangan (termasuk ganti orang tertaut), tautkan otomatis anak ke pasangan dua arah, dan kembalikan tampilan pasangan di `/silsilah` ke satu baris yang sama.

**Architecture:** Empat lapis: (1) kembalikan layout `treeLayout.ts` agar pasangan sebaris dengan kartu darah tanpa membatalkan urutan anak global; (2) modul server baru `src/lib/relation-sync.ts` berisi logika auto-link yang bisa diuji dengan DB palsu; (3) aksi API `edit-relation` & `edit-partner` plus penautan otomatis di route `relasi`; (4) form Edit di `FamilyTreeModal`. Skema basis data tidak berubah.

**Tech Stack:** Next.js 16 App Router, React 19, Prisma 7, TypeScript 5, Tailwind 4, `@xyflow/react`. Tes dijalankan dengan `npx tsx --test <file>` (tanpa agregator).

**Spec:** `docs/superpowers/plans/2026-10-01-urutan-anak.md` (keputusan urutan anak tetap mengikat) dan permintaan produk dalam sesi 2026-10-02.

## Global Constraints

- Jalankan tes per file: `npx tsx --test <path>`; tidak ada `npm test`.
- `npx tsc --noEmit` harus 0 error; `npx eslint <file>` bersih; `npm run build` sukses.
- Cabang kerja: `main` (alur repo ini adalah commit langsung ke `main` lalu deploy; disetujui pengguna).
- Batas orang tua: `MAX_PARENTS = 2`. Sebuah anak tidak boleh punya lebih dari 2 baris `PersonChild`.
- Anti-siklus wajib: orang tua tidak boleh menjadi keturunan anaknya.
- Invariant urutan anak: SELURUH baris `PersonChild` milik satu anak harus punya `orderIndex` yang sama (ayah dan ibu baris disinkronkan).
- RBAC fail-closed: setiap endpoint relasi dicek dengan `assertPersonAccess(scope, id)`.
- Setiap perubahan relasi menulis `logAudit`.
- Copy UI berbahasa Indonesia, tanpa em dash.
- Layout pasangan: kartu darah dan SEMUA pasangannya berada di baris yang sama (`y = 0`), pasangan berjajar ke kanan mengikuti `orderIndex`. Anak mulai satu baris di bawah. Urutan anak global (`orderIndex` -> `createdAt` -> `childId`) tidak boleh berubah.
- Auto-link hanya dijalankan pada aksi `add` dan `add-new` (bukan `edit`), agar mengedit tidak diam-diam menambah relasi.
- Auto-link menghormati `MAX_PARENTS`, anti-duplikat, dan menyinkronkan `orderIndex`.

## Review Focus

1. **Auto-link salah pasang**: orang punya >1 pasangan maka auto-link TIDAK dijalankan (ambiguitas). Uji: orang dengan 2 pasangan, tambah anak -> anak hanya tertaut ke orang tua yang dipilih.
2. **Auto-link melampaui 2 orang tua**: anak sudah punya 2 orang tua, tambah pasangan -> tidak ada baris ke-3. Uji: anak 2 orang tua, orang tua punya pasangan baru.
3. **Ganti orang tertaut membentuk siklus / duplikat**: `edit-relation` ganti anak dengan keturunannya sendiri, atau ke pasangan yang sudah ada. Uji: `edit-relation` dengan `newTargetPersonId` melingkar -> 409.
4. **OrderIndex tidak sinkron setelah edit/ganti orang**: baris ayah dan ibu berbeda nomor. Uji: setelah `edit-relation` ganti orang tua, kedua baris anak bernomor sama.
5. **Pasangan bertumpuk setelah layout sebaris**: pernikahan berantai (P1 menikah P2, P2 menikah P3) menaruh kartu berdekatan/overlap. Uji: `kartu pada baris yang sama tidak bertumpuk` untuk fixture berantai.

---

### Task 1: Layout pasangan sebaris

**Files:**
- Modify: `src/components/silsilah/treeLayout.ts` (fungsi `layoutFamily`, sekitar baris 254-428)
- Test: `src/components/silsilah/treeLayout.test.ts`

**Interfaces:**
- Consumes: tidak ada dari task lain.
- Produces: `buildTreeGraph()` dengan jaminan baru: semua pasangan `y = 0` (sebaris dengan kartu darah). `FamilyMarriageEdgeData { x1,y1,x2,y2 }` tetap sama; untuk pasangan sebaris `y1 === y2`. `FamilyEdges.tsx` TIDAK berubah.

**Konteks:** Versi saat ini (commit `52e7ee8`) menaruh pasangan di `partnerRow` pada baris terpisah. Nilai yang benar ada pada commit `aa3ce0f`, tetapi versi itu memakai `FamilyMarriageEdgeData { kind, y }` lama. Ambil kembali logika baris `aa3ce0f` dan pertahankan geometri `{ x1,y1,x2,y2 }` yang sekarang.

- [ ] **Step 1: Ubah tes lama menjadi tes pasangan sebaris**

Ganti tes bernama `"buildTreeGraph menaruh pasangan di baris bawah, bukan menyelip di antara anak"` (sekitar baris 458) dengan:

```ts
test("buildTreeGraph menaruh pasangan sebaris dengan kartu darah", () => {
  const { nodes } = buildTreeGraph(fixture(), new Set());
  const a05 = nodes.find((n) => n.id === "A05")!;
  const a06 = nodes.find((n) => n.id === "A06")!;
  assert.equal(a05.position.y, a06.position.y, "pasangan harus sebaris");
  assert.notEqual(a05.position.x, a06.position.x, "pasangan harus terpisah horizontal");

  const couple = buildTreeGraph(coupleChildrenFixture(), new Set());
  const yOf = (id: string) => couple.nodes.find((n) => n.id === id)!.position.y;
  assert.equal(yOf("A"), yOf("B"), "kedua pasangan sebaris");
  assert.notEqual(yOf("A"), yOf("Y1"), "anak di baris bawah pasangan");
  assert.notEqual(yOf("B"), yOf("Y1"), "anak di baris bawah pasangan");
});
```

Perbarui juga tes `"buildTreeGraph memak saudara daun di kontur baris, bukan setelah subtree lebar"` (sekitar baris 428) agar pasangan sebaris dengan A:

```ts
  // B sebaris dengan A (sesama anak P); AP juga sebaris dengan A.
  assert.equal(yOf("B"), yOf("A"), "B harus sebaris dengan A");
  assert.equal(yOf("AP"), yOf("A"), "pasangan AP sebaris dengan A");
  assert.ok(xOf("B") > xOf("AP"), "B harus di kanan pasangan A");
  assert.ok(
    xOf("B") - (xOf("AP") + 260) >= NODE_MIN_GAP,
    `B tidak boleh menimpa AP, jarak=${Math.round(xOf("B") - (xOf("AP") + 260))}`,
  );
```

- [ ] **Step 2: Jalankan tes, pastikan GAGAL**

Run: `npx tsx --test src/components/silsilah/treeLayout.test.ts`
Expected: FAIL pada tes pasangan sebaris (`pasangan harus sebaris`) karena masih di baris terpisah.

- [ ] **Step 3: Kembalikan `layoutFamily` ke pasangan sebaris**

Di `src/components/silsilah/treeLayout.ts`, di dalam `layoutFamily`:

1. Hapus `partnerRow`. Ganti blok baris menjadi:

```ts
    // Baris kartu: primary di x=0, lalu semua pasangan (termasuk pasangan dari
    // pasangan) berjajar ke kanan mengikuti BFS, sehingga pernikahan berantai
    // tetap satu pohon dan tidak ada pasangan yang hilang.
    const row: { id: string; x: number }[] = [{ id: pid, x: 0 }];
    const queue: string[] = [pid];
    let primaryStatus: PersonNodeData["partnerStatus"] = null;

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const pr of partnerOf(current)) {
        if (seen.has(pr.id)) continue;
        seen.add(pr.id);
        const x = row.length * COUPLE_SPACING;
        row.push({ id: pr.id, x });
        queue.push(pr.id);
        partnerLinks.push({ a: current, b: pr.id, edge: pr.edge });
        if (current === pid && primaryStatus === null) {
          primaryStatus = (pr.edge.status ?? null) as PersonNodeData["partnerStatus"];
        }
      }
    }

    const positions: PlacedNode[] = row.map((card) => {
      const status =
        card.id === pid
          ? primaryStatus
          : (partnerLinks.find((l) => l.a === card.id || l.b === card.id)?.edge.status ??
            null) as PersonNodeData["partnerStatus"];
      return { id: card.id, x: card.x, y: 0, partnerStatus: status };
    });
```

2. Hapus `const childY = NODE_H + GAP_Y;` dari awal (biarkan didefinisikan sekali sebelum pengemasan, seperti versi `aa3ce0f`) dan hapus loop `for (const card of [...row, ...partnerRow])` menjadi `for (const card of row)`.

3. Ganti perhitungan baris milik keluarga dan pengemasan:

```ts
    const childY = NODE_H + GAP_Y;
    const cardsWidth = (row.length - 1) * COUPLE_SPACING + NODE_W;
    const placements: { offset: number; block: (typeof blocks)[number] }[] = [];
    const occupied = new Map<number, number>([[0, cardsWidth]]);
    let childHeight = 0;
    for (const block of blocks) {
      let offset = 0;
      for (let d = 0; d < block.layout.leftContour.length; d++) {
        const limit = occupied.get(d + 1);
        if (limit === undefined) continue;
        const candidate = limit + GAP_X - block.layout.leftContour[d];
        if (candidate > offset) offset = candidate;
      }
      placements.push({ offset, block });
      for (let d = 0; d < block.layout.rightContour.length; d++) {
        const limit = occupied.get(d + 1);
        const right = offset + block.layout.rightContour[d];
        if (limit === undefined || right > limit) occupied.set(d + 1, right);
      }
      childHeight = Math.max(childHeight, block.layout.height);
    }
    const childrenLeft =
      placements.length > 0
        ? Math.min(...placements.map((p) => p.offset + p.block.layout.left))
        : cardsWidth / 2;
    const childrenRight =
      placements.length > 0
        ? Math.max(...placements.map((p) => p.offset + p.block.layout.right))
        : cardsWidth / 2;
    const childrenCenter = (childrenLeft + childrenRight) / 2;
    const shift = cardsWidth / 2 - childrenCenter;

    let left = 0;
    let right = cardsWidth;
    for (const { offset, block } of placements) {
      for (const p of block.layout.positions) {
        const x = p.x + offset + shift;
        const y = p.y + childY;
        positions.push({ ...p, x, y });
        left = Math.min(left, x);
        right = Math.max(right, x + NODE_W);
      }
      partnerLinks.push(...block.layout.partnerLinks);
      childBus.push(...block.layout.childBus);
      childBus.push({ childId: block.childId, parentIds: block.parentIds });
    }

    const height = blocks.length > 0 ? childY + childHeight : NODE_H;
```

4. Pada kontur, pakai `const d = Math.round(p.y / childY);` (bukan pembagian mentah) agar aman floating point.

5. Pertahankan kode edge pernikahan `{ x1, y1, x2, y2 }` dan penanganan `sameRow` (baris ~481-517) apa adanya.

- [ ] **Step 4: Jalankan tes, pastikan LULUS**

Run: `npx tsx --test src/components/silsilah/treeLayout.test.ts`
Expected: PASS semua (termasuk `kartu pada baris yang sama tidak bertumpuk`, urutan global, dan determinisme).

- [ ] **Step 5: Commit**

```bash
git add src/components/silsilah/treeLayout.ts src/components/silsilah/treeLayout.test.ts
git commit -m "fix(silsilah): pasangan sebaris dengan kartu darah"
```

---

### Task 2: Modul auto-link `relation-sync`

**Files:**
- Create: `src/lib/relation-sync.ts`
- Test: `src/lib/relation-sync.test.ts`

**Interfaces:**
- Consumes: tidak ada dari task lain.
- Produces:
  - `type RelationSyncDb = { personChild: { findMany(args: unknown): Promise<ChildRow[]>; create(args: unknown): Promise<unknown> }; personPartner: { findMany(args: unknown): Promise<PartnerRow[]> } }`
  - `type ChildRow = { parentId: string; childId: string; parentRole: string; orderIndex: number }`
  - `type PartnerRow = { partnerAId: string; partnerBId: string; status: string }`
  - `autoLinkChildToPartner(childId: string, parentId: string, partnerRole: "FATHER" | "MOTHER" | "UNKNOWN", db: RelationSyncDb): Promise<{ linkedPartnerId: string | null }>`
  - `autoLinkChildrenToPartner(personId: string, partnerId: string, partnerRole: "FATHER" | "MOTHER" | "UNKNOWN", db: RelationSyncDb): Promise<{ linkedChildIds: string[] }>`
  - `const MAX_PARENTS = 2` (diekspor)

- [ ] **Step 1: Tulis tes yang gagal untuk kedua penautan**

Buat `src/lib/relation-sync.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  autoLinkChildToPartner,
  autoLinkChildrenToPartner,
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
```

- [ ] **Step 2: Jalankan tes, pastikan GAGAL**

Run: `npx tsx --test src/lib/relation-sync.test.ts`
Expected: FAIL `Cannot find module './relation-sync'`.

- [ ] **Step 3: Implementasi `src/lib/relation-sync.ts`**

```ts
// Server-only. Logika penautan otomatis anak <-> pasangan, dapat diuji dengan
// klien basis data palsu (lihat pola yang sama di src/lib/child-order.ts).

export const MAX_PARENTS = 2;

export type ChildRow = {
  parentId: string;
  childId: string;
  parentRole: string;
  orderIndex: number;
};

export type PartnerRow = { partnerAId: string; partnerBId: string; status: string };

export type RelationSyncDb = {
  personChild: {
    findMany(args: unknown): Promise<ChildRow[]>;
    create(args: unknown): Promise<unknown>;
  };
  personPartner: {
    findMany(args: unknown): Promise<PartnerRow[]>;
  };
};

export type ParentRoleValue = "FATHER" | "MOTHER" | "UNKNOWN";

/** Pasangan tunggal seseorang, atau null bila tidak ada / lebih dari satu. */
async function solePartner(personId: string, db: RelationSyncDb): Promise<string | null> {
  const partners = await db.personPartner.findMany({
    where: { OR: [{ partnerAId: personId }, { partnerBId: personId }] },
  });
  if (partners.length !== 1) return null;
  const p = partners[0];
  return p.partnerAId === personId ? p.partnerBId : p.partnerAId;
}

/**
 * Setelah anak ditautkan ke `parentId`, tautkan juga ke pasangan tunggal
 * `parentId` (bila ada tepat satu, belum jadi orang tua anak itu, dan anak
 * masih punya < MAX_PARENTS orang tua).
 */
export async function autoLinkChildToPartner(
  childId: string,
  parentId: string,
  partnerRole: ParentRoleValue,
  db: RelationSyncDb,
): Promise<{ linkedPartnerId: string | null }> {
  const partnerId = await solePartner(parentId, db);
  if (!partnerId || partnerId === childId) return { linkedPartnerId: null };

  const rows = await db.personChild.findMany({ where: { childId } });
  if (rows.some((r) => r.parentId === partnerId)) return { linkedPartnerId: null };
  if (rows.length >= MAX_PARENTS) return { linkedPartnerId: null };

  await db.personChild.create({
    data: {
      parentId: partnerId,
      childId,
      parentRole: partnerRole,
      orderIndex: rows[0]?.orderIndex ?? 0,
    },
  });
  return { linkedPartnerId: partnerId };
}

/**
 * Saat pasangan baru `partnerId` ditambahkan ke `personId`, tautkan anak-anak
 * `personId` yang masih berorang-tua tunggal (hanya `personId`) ke pasangan itu.
 */
export async function autoLinkChildrenToPartner(
  personId: string,
  partnerId: string,
  partnerRole: ParentRoleValue,
  db: RelationSyncDb,
): Promise<{ linkedChildIds: string[] }> {
  const ownRows = await db.personChild.findMany({ where: { parentId: personId } });
  const candidateIds = [...new Set(ownRows.map((r) => r.childId))];
  if (candidateIds.length === 0) return { linkedChildIds: [] };

  const allRows = await db.personChild.findMany({
    where: { childId: { in: candidateIds } },
  });

  const byChild = new Map<string, ChildRow[]>();
  for (const row of allRows) {
    const arr = byChild.get(row.childId) ?? [];
    arr.push(row);
    byChild.set(row.childId, arr);
  }

  const linkedChildIds: string[] = [];
  for (const childId of candidateIds) {
    const rows = byChild.get(childId) ?? [];
    if (rows.length !== 1) continue; // sudah punya dua orang tua
    if (rows[0].parentId !== personId) continue;
    if (rows.some((r) => r.parentId === partnerId)) continue;
    await db.personChild.create({
      data: {
        parentId: partnerId,
        childId,
        parentRole: partnerRole,
        orderIndex: rows[0].orderIndex,
      },
    });
    linkedChildIds.push(childId);
  }
  return { linkedChildIds };
}

/** Peran orang tua dari jenis kelamin, untuk penautan otomatis. */
export function partnerRoleFromGender(gender: string): ParentRoleValue {
  if (gender === "MALE") return "FATHER";
  if (gender === "FEMALE") return "MOTHER";
  return "UNKNOWN";
}
```

- [ ] **Step 4: Jalankan tes, pastikan LULUS**

Run: `npx tsx --test src/lib/relation-sync.test.ts`
Expected: PASS (6 tes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/relation-sync.ts src/lib/relation-sync.test.ts
git commit -m "feat(relasi): modul auto-link anak dan pasangan"
```

---

### Task 3: API `edit-relation` & `edit-partner`

**Files:**
- Modify: `src/app/api/admin/relasi/route.ts` (tambah `case` baru sebelum `default`)
- Modify: `src/lib/family-tree.ts` (`PartnerEntry` + include, agar form edit punya data tanggal/catatan)
- Test: `src/app/api/admin/relasi/route.test.ts`

**Interfaces:**
- Consumes: `MAX_PARENTS` dari `@/lib/relation-sync` (Task 2).
- Produces:
  - `edit-relation` body: `{ action:"edit-relation", edgeId, relationType:"parent"|"child", newTargetPersonId?, parentRole?, isStep?, isAdopted? }` -> `{ ok: true }`.
  - `edit-partner` body: `{ action:"edit-partner", edgeId, newPartnerId?, status?, marriageDate?, divorceDate?, notes? }` -> `{ ok: true }`.
  - `PartnerEntry` diperluas menjadi `{ edgeId, status, marriageDate, divorceDate, notes, member }`.

- [ ] **Step 1: Perluas `PartnerEntry` dan query-nya**

Di `src/lib/family-tree.ts`:
- Ubah `export type PartnerEntry = { edgeId: string; status: string; member: TreeMember };` menjadi:
```ts
export type PartnerEntry = {
  edgeId: string;
  status: string;
  marriageDate: string | null;
  divorceDate: string | null;
  notes: string | null;
  member: TreeMember;
};
```
- Ubah `partnershipsA`/`partnershipsB` pada `PersonDetailRow` agar memuat `marriageDate`, `divorceDate`, `notes` (tipe `Date | string | null` untuk tanggal).
- Pada `buildPartners`, sertakan ketiga field (tanggal diubah ke ISO string atau `null`): `marriageDate: row.marriageDate ? new Date(row.marriageDate).toISOString() : null`, serupa untuk `divorceDate`, dan `notes: row.notes ?? null`.
- Pada `getFamilyTreeData` include `partnershipsA/partnershipsB`, tambahkan `marriageDate: true, divorceDate: true, notes: true`.

- [ ] **Step 2: Tulis tes API yang gagal**

Di `src/app/api/admin/relasi/route.test.ts` tambahkan tes. Ikuti pola loader `loadModule` + `runInNewContext` yang sudah ada di file ini (impor `readFileSync`, `createRequire`, `resolve`, `runInNewContext`, `ts`). Tambahkan kasus:

```ts
test("edit-relation menolak ganti orang tua yang membentuk siklus", async () => { /* edge parentId=P childId=C, newTargetPersonId = keturunan C -> 409 */ });
test("edit-relation menolak anak yang sudah punya 2 orang tua", async () => { /* newTargetPersonId punya 2 parent -> 409 */ });
test("edit-relation menyinkronkan orderIndex seluruh baris anak", async () => { /* setelah update parentRole, kedua baris bernilai sama */ });
test("edit-partner memperbarui status dan tanggal", async () => { /* status DIVORCED, divorceDate terisi, 1 update, 1 audit */ });
test("edit-partner menolak pasangan duplikat", async () => { /* newPartnerId sudah terhubung -> 409 */ });
```

Tes harus memverifikasi: balasan 200/409, jumlah `personChild.update`/`personPartner.update`, dan `logAudit` terpanggil dengan aksi `RELATION_UPDATE_CHILD` / `RELATION_UPDATE_PARTNER`.

- [ ] **Step 3: Jalankan tes, pastikan GAGAL**

Run: `npx tsx --test src/app/api/admin/relasi/route.test.ts`
Expected: FAIL karena `edit-relation` / `edit-partner` belum ada (balasan 400 "Action tidak dikenal").

- [ ] **Step 4: Implementasi dua action di `relasi/route.ts`**

Tambahkan sebelum `default:`:

`edit-relation`:
1. `const { edgeId, relationType } = body;` validasi `edgeId` dan `relationType` ∈ {parent, child}.
2. `const edge = await prisma.personChild.findUnique({ where: { id: edgeId } })`; 404 bila tidak ada.
3. `await assertPersonAccess(scope, edge.parentId); await assertPersonAccess(scope, edge.childId);`
4. Tentukan `newTargetPersonId = body.newTargetPersonId as string | undefined`.
5. Bila `newTargetPersonId` diisi dan berbeda dari endpoint yang diganti:
   - Untuk `relationType === "child"`: orang yang diganti adalah `childId` -> `newChildId = newTargetPersonId`, `parentId = edge.parentId`.
   - Untuk `relationType === "parent"`: `newParentIds = newTargetPersonId`, `childId = edge.childId`.
   - `await assertPersonAccess(scope, newTargetPersonId)`.
   - Tolak `newTargetPersonId === childIdAsli/parentIdAsli` yang jadi diri sendiri (`parentId === childId`).
   - Cek duplikat: `prisma.personChild.findFirst({ where: { parentId, childId } })` -> 409.
   - Cek batas: untuk perubahan child baru, `count({ where: { childId: newChildId } }) >= MAX_PARENTS` -> 409 (kecuali baris edge lama dihitung? baris lama milik child LAMA, jadi tidak masuk hitungan child baru).
   - Anti-siklus: `validateParentChild(parentId, childId)` (fungsi yang sudah ada) -> 409.
   - Lakukan `personChild.update` mengubah `parentId` atau `childId` sesuai tipe, sekaligus field `parentRole/isStep/isAdopted` yang dikirim, dibungkus `$transaction`; setelah ganti orang, panggil `setChildOrderIndex` untuk child yang terpengaruh (lama dan baru) memakai `orderIndex` baris yang tersisa agar invariant terjaga.
6. Bila tidak ganti orang: `personChild.update({ where:{id:edgeId}, data:{ parentRole?, isStep?, isAdopted? } })`.
7. `logAudit({ action:"RELATION_UPDATE_CHILD", entityType:"Person", entityId: edge.childId, actorUserId, beforeData: edge, afterData: body })`.
8. `try { await recalculateGenerationLevel(edge.childId); } catch {}`.
9. `return NextResponse.json({ ok: true })`.

`edit-partner`:
1. Validasi `edgeId`. `const edge = await prisma.personPartner.findUnique(...)`; 404.
2. `assertPersonAccess` kedua partner.
3. `newPartnerId` opsional: tolak `newPartnerId === partnerAId/partnerBId`; tolak duplikat via `findFirst({ where:{ OR:[...] } })`; `assertPersonAccess` partner baru. Ganti field `partnerAId`/`partnerBId` sesuai sisi `edge.partnerAId`/`partnerBId`.
4. Field opsional: `status` (validasi enum `MARRIED|DIVORCED|WIDOWED|UNKNOWN`), `marriageDate`, `divorceDate` (parse `new Date`, tolak Invalid Date dengan 400), `notes`.
5. `personPartner.update`; `logAudit({ action:"RELATION_UPDATE_PARTNER", ... })`; `return { ok:true }`.

- [ ] **Step 5: Jalankan tes, pastikan LULUS**

Run: `npx tsx --test src/app/api/admin/relasi/route.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 error. Perbaiki pemakai `PartnerEntry` lain bila ada (mis. `FamilyTreeModal` tipe lokal) agar ikut memuat field baru.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/admin/relasi/route.ts src/app/api/admin/relasi/route.test.ts src/lib/family-tree.ts
git commit -m "feat(relasi): aksi API edit relasi anak dan pasangan"
```

---

### Task 4: Auto-link di aksi `add` dan `add-new`

**Files:**
- Modify: `src/app/api/admin/relasi/route.ts`
- Test: `src/app/api/admin/relasi/route.test.ts`

**Interfaces:**
- Consumes: `autoLinkChildToPartner`, `autoLinkChildrenToPartner`, `partnerRoleFromGender` dari `@/lib/relation-sync` (Task 2); struktur route dari Task 3.
- Produces: balasan `add` / `add-new` menyertakan `linkedPartnerId` (child) atau `linkedChildIds` (partner) sebagai informasi, tanpa mengubah kontrak sukses utama (`ok: true`, dan `personId` untuk `add-new`).

- [ ] **Step 1: Tulis tes yang gagal**

Tambahkan di `route.test.ts`:

```ts
test("add child menautkan anak ke pasangan tunggal orang tuanya", async () => { /* P punya pasangan Q; add child C -> 2 create PersonChild (P->C, Q->C) */ });
test("add child TIDAK menautkan bila orang tua punya dua pasangan", async () => { /* 1 create saja */ });
test("add-new partner menautkan anak tunggal orang tua ke pasangan baru", async () => { /* P punya C1,C2 satu orang tua; add-new partner -> 2 create tambahan */ });
test("add partner menautkan anak tunggal ke pasangan terdaftar", async () => { /* add existing partner Q ke P -> anak C milik P ditautkan ke Q */ });
```

Perluas fake `prisma` yang ada dengan `personPartner.findMany`, `personChild.count`, dan `personChild.create` bila belum ada; catat hasil `create` untuk diperiksa.

- [ ] **Step 2: Jalankan tes, pastikan GAGAL**

Run: `npx tsx --test src/app/api/admin/relasi/route.test.ts`
Expected: FAIL (belum ada penautan).

- [ ] **Step 3: Pasang auto-link**

Impor di atas `route.ts`:
```ts
import {
  autoLinkChildToPartner,
  autoLinkChildrenToPartner,
  partnerRoleFromGender,
  type RelationSyncDb,
} from "@/lib/relation-sync";
```

Pada `case "add"`:
- `relationType === "child"`: setelah blok transaksi yang membuat edge, tentukan gender pasangan bila ada. Ambil pasangan tunggal via `autoLinkChildToPartner` — tetapi fungsi itu mencari pasangan dari `parentId`. Untuk peran pasangan, ambil dulu pasangannya:
  - Di dalam blok transaksi setelah edge anak dibuat, panggil `autoLinkChildToPartner(targetPersonId, personId, role pasangan, tx as unknown as RelationSyncDb)`. Peran pasangan perlu gender pasangan: sebelum transaksi, jika `person` (fokus) punya pasangan tunggal, ambil person pasangan `findUnique` dan hitung `partnerRoleFromGender(gender)`. Simpelnya: ambil `const linked = await autoLinkChildToPartner(...)` di dalam transaksi, dan hitung peran dari `target` (anak)? Tidak: peran adalah peran ORANG TUA pasangan, bukan anak. Hitung peran pasangan dari gender orang tua pasangan.
  - Simpan `linkedPartnerId` dan kembalikan di JSON.
- `relationType === "partner"`: setelah `personPartner.create`, panggil `autoLinkChildrenToPartner(personId, targetPersonId, partnerRoleFromGender(target.gender), prisma as unknown as RelationSyncDb)` dan kembalikan `linkedChildIds`.

Pada `case "add-new"`:
- `relationType === "child"`: setelah edge anak dibuat, panggil `autoLinkChildToPartner(created.id, personId, <peran pasangan personId>, tx)`. Bila `personId` punya pasangan tunggal, ambil gender pasangan itu untuk peran.
- `relationType === "partner"`: setelah edge partner dibuat, panggil `autoLinkChildrenToPartner(personId, created.id, partnerRoleFromGender(gender), tx)`; sertakan `linkedChildIds`.

Helper kecil `partnerRoleForParent(parentId, db)` boleh ditambahkan di `relation-sync.ts` bila mempermudah (opsional; boleh juga ambil pasangan langsung di route). Kembalikan `linkedPartnerId`/`linkedChildIds` di `NextResponse.json`.

- [ ] **Step 4: Jalankan tes, pastikan LULUS**

Run: `npx tsx --test src/app/api/admin/relasi/route.test.ts src/lib/relation-sync.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/app/api/admin/relasi/route.ts src/lib/relation-sync.ts`
Expected: 0 error, lint bersih.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/relasi/route.ts src/app/api/admin/relasi/route.test.ts
git commit -m "feat(relasi): tautkan anak dan pasangan otomatis saat tambah"
```

---

### Task 5: Form Edit di `FamilyTreeModal`

**Files:**
- Modify: `src/components/keluarga/FamilyTreeModal.tsx`
- Test: `src/components/keluarga/parent-search.test.ts` (jika perlu; tidak ada tes render modal saat ini, jadi verifikasi lewat `tsc` + build + uji manual di Task 6).

**Interfaces:**
- Consumes: `PartnerEntry` baru dari Task 3; endpoint `POST /api/admin/relasi` aksi `edit-relation`/`edit-partner`; endpoint `PUT /api/admin/keluarga/person/[id]` untuk identitas; `searchMembers` yang sudah ada.
- Produces: UI edit, tidak ada ekspor tipe baru yang dipakai task lain.

- [ ] **Step 1: Perluas tipe payload lokal + field form**

Ubah `PartnerEntry` lokal menjadi `{ edgeId; status; marriageDate: string | null; divorceDate: string | null; notes: string | null; member: TreeMember }`. Tambahkan state `editing` (`{ kind:"child"|"partner"; edgeId:string } | null`).

- [ ] **Step 2: Tambah tombol Edit dan form inline**

- Di setiap baris anak: tombol **Edit** memunculkan form (di bawah baris) berisi:
  - Peran orang tua: pilih `FATHER`/`MOTHER`/`UNKNOWN` (relasi anak dari sudut pandang orang fokus).
  - Centang **Anak tiri** (`isStep`), **Anak angkat** (`isAdopted`).
  - **Ganti orang**: input pencarian memakai mesin `createParentSearch` yang sama dengan `ParentPicker`; memilih anggota menetapkan `newTargetPersonId`.
  - **Simpan**: panggil `edit-relation` dengan field yang relevan. Bila identitas anak ingin diubah, panggil `PUT /api/admin/keluarga/person/[id]` lebih dulu (nama, jenis kelamin, tanggal lahir), lalu `edit-relation`.
- Di setiap baris pasangan: tombol **Edit** memunculkan form:
  - Status: `Menikah` (`MARRIED`), `Cerai` (`DIVORCED`), `Pasangan wafat` (`WIDOWED`), `Belum diketahui` (`UNKNOWN`).
  - Tanggal menikah, tanggal cerai (`type="date"`), catatan.
  - **Ganti orang**: pencarian anggota -> `newPartnerId`.
  - **Simpan**: panggil `edit-partner`.
- Setelah sukses `mutate`, tutup form (state `editing = null`) dan reload (sudah otomatis lewat `setReloadKey`).
- Tampilkan pesan sukses auto-link bila balasan memuat `linkedPartnerId` / `linkedChildIds` (mis. "Anak sekaligus ditautkan ke pasangan.").

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 error.

- [ ] **Step 4: Lint**

Run: `npx eslint src/components/keluarga/FamilyTreeModal.tsx`
Expected: bersih.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: sukses.

- [ ] **Step 6: Commit**

```bash
git add src/components/keluarga/FamilyTreeModal.tsx
git commit -m "feat(admin): form edit relasi anak dan pasangan"
```

---

### Task 6: Verifikasi menyeluruh & deploy

**Files:**
- Tidak ada perubahan kode (kecuali perbaikan yang ditemukan verifikasi).

**Interfaces:**
- Consumes: semua task sebelumnya.
- Produces: `/silsilah` dan form admin ter-deploy di `https://wirjodihardjo.teknoloka.id`.

- [ ] **Step 1: Suite lengkap**

Run seluruh file tes terkait:
```bash
npx tsx --test src/components/silsilah/treeLayout.test.ts \
  src/components/silsilah/FamilyEdges.test.ts \
  src/components/silsilah/PersonNode.test.tsx \
  src/lib/relation-sync.test.ts \
  src/lib/child-order.test.ts \
  src/lib/family-tree.test.ts \
  src/app/api/admin/relasi/route.test.ts
```
Expected: PASS semua.

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: 0 error, build sukses.

- [ ] **Step 3: Verifikasi data nyata (DB prod lokal)**

Cek bahwa layout menghasilkan pasangan sebaris dan anak berurutan pada data nyata. Gunakan skrip Node/Puppeteer yang mengambil `https://wirjodihardjo.teknoloka.id/silsilah` (atau render lokal) dan periksa: tidak ada kartu bertumpuk, pasangan punya `y` sama, anak founder urut. Dicatat sebagai bukti (jumlah node, jumlah baris, 0 overlap).

- [ ] **Step 4: Deploy**

```bash
docker compose build wirjodihardjo-app
docker compose up -d wirjodihardjo-app
```
Tunggu container sehat; cek log bersih; `curl -sS -o /dev/null -w '%{http_code}' https://wirjodihardjo.teknoloka.id/silsilah` -> `200`.

- [ ] **Step 5: Commit sisa (bila ada) dan push**

```bash
git push origin main
```
Expected: push sukses.

---

## Catatan Ruling (keputusan controller)

- **Branch `main` langsung**: alur repo ini commit ke `main` lalu deploy, dan pengguna meminta "kerjakan semua plan" + deploy. Ini disetujui lewat permintaan sesi, bukan kerja fitur terisolasi.
- **Auto-link tidak di `edit`**: pengguna menyebut auto-link saat "buat pasangan" dan saat anak diisi. Mengedit relasi tidak boleh menambah relasi diam-diam; auto-link hanya di `add`/`add-new`.
- **Auto-link untuk semua status pasangan**: pengguna memilih opsi 1 dan 2 dan tidak memilih batasan "hanya menikah". Bila terasa salah untuk pasangan cerai, mudah dibatasi nanti.

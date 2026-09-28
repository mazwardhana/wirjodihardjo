import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { fixture, loadRoute, request, type Row } from "../../../../../tests/helpers/profile-route";

// Fixture khusus relasi: memakai ulang fixture dasar (auth + akun) lalu
// menambah model PersonChild/PersonPartner dengan graf kecil yang deterministik.
function relationsFixture() {
  const f = fixture();
  const people: Record<string, Row> = {
    p1: { id: "p1", fullName: "Budi", nickname: "Bud", gender: "MALE", branchId: "b1", generationLevel: 1, isDeceased: false, photoUrl: null, birthDate: new Date("1970-01-01") },
    p2: { id: "p2", fullName: "Ayah Budi", nickname: null, gender: "MALE", branchId: "b1", generationLevel: 0, isDeceased: false, photoUrl: null, birthDate: null },
    p3: { id: "p3", fullName: "Orang Cabang Lain", nickname: null, gender: "MALE", branchId: "b2", generationLevel: 0, isDeceased: false, photoUrl: null, birthDate: null },
    p4: { id: "p4", fullName: "Kakek Budi", nickname: null, gender: "MALE", branchId: "b1", generationLevel: -1, isDeceased: true, photoUrl: null, birthDate: null },
    p5: { id: "p5", fullName: "Anak Muda", nickname: null, gender: "FEMALE", branchId: "b1", generationLevel: 2, isDeceased: false, photoUrl: null, birthDate: new Date("1990-05-01") },
    p6: { id: "p6", fullName: "Anak Tua", nickname: null, gender: "MALE", branchId: "b1", generationLevel: 2, isDeceased: false, photoUrl: null, birthDate: new Date("1980-05-01") },
    p7: { id: "p7", fullName: "Istri Budi", nickname: null, gender: "FEMALE", branchId: "b1", generationLevel: 1, isDeceased: false, photoUrl: null, birthDate: null },
    p8: { id: "p8", fullName: "Cucu Budi", nickname: null, gender: "MALE", branchId: "b1", generationLevel: 3, isDeceased: false, photoUrl: null, birthDate: null },
  };
  const parentsOf: Record<string, Row[]> = {
    p1: [{ parentId: "p2", parentRole: "FATHER", isStep: false, isAdopted: false, parent: people.p2 }],
    p2: [{ parentId: "p4", parentRole: "FATHER", isStep: false, isAdopted: false, parent: people.p4 }],
  };
  const childrenOf: Record<string, Row[]> = {
    p1: [
      { childId: "p6", parentRole: "FATHER", isStep: false, isAdopted: false, child: people.p6 },
      { childId: "p5", parentRole: "FATHER", isStep: false, isAdopted: false, child: people.p5 },
    ],
    p6: [{ childId: "p8", parentRole: "FATHER", isStep: false, isAdopted: false, child: people.p8 }],
  };
  const created: Row[] = [];
  const upserted: Row[] = [];
  const partner = { edges: [] as Row[], writes: [] as Row[] };

  Object.assign(f.prisma, {
    person: {
      findUnique: async (args: { where: Row }) => people[(args.where as Row).id as string] ?? null,
      findMany: async (args: Row) => {
        const where = (args.where ?? {}) as Row;
        let rows = Object.values(people);
        if (typeof where.branchId === "string") rows = rows.filter((p) => p.branchId === where.branchId);
        const notId = where.id && typeof where.id === "object" ? (where.id as Row).not : undefined;
        if (typeof notId === "string") rows = rows.filter((p) => p.id !== notId);
        if (Array.isArray(where.OR)) {
          const terms = where.OR as Row[];
          rows = rows.filter((p) =>
            terms.some((term) => {
              const contains = (term.fullName as Row | undefined)?.contains;
              return typeof contains === "string" && String(p.fullName).toLowerCase().includes(contains.toLowerCase());
            }),
          );
        }
        return rows;
      },
    },
    personChild: {
      findMany: async (args: Row) => {
        const where = (args.where ?? {}) as Row;
        const child = where.childId;
        if (typeof child === "string") return parentsOf[child] ?? [];
        if (child && typeof child === "object") {
          const ids = ((child as Row).in as string[]) ?? [];
          return ids.flatMap((id) => parentsOf[id] ?? []);
        }
        const parent = where.parentId;
        const excluded = where.childId && typeof where.childId === "object" ? (where.childId as Row).not : undefined;
        if (typeof parent === "string") return childrenOf[parent] ?? [];
        if (parent && typeof parent === "object") {
          const ids = ((parent as Row).in as string[]) ?? [];
          return ids.flatMap((id) => childrenOf[id] ?? []).filter((edge) => edge.childId !== excluded);
        }
        return [];
      },
      upsert: async (args: Row) => { upserted.push(args); return args; },
      deleteMany: async () => ({ count: 0 }),
    },
    personPartner: {
      findMany: async () => [...partner.edges].sort((a, b) => Number(a.orderIndex ?? 0) - Number(b.orderIndex ?? 0)),
      findFirst: async (args: Row) => {
        const terms = (((args?.where ?? {}) as Row).OR as Row[]) ?? [];
        return partner.edges.find((edge) =>
          terms.some((term) => term.partnerAId === edge.partnerAId && term.partnerBId === edge.partnerBId),
        ) ?? null;
      },
      count: async (args: Row) => {
        const terms = (((args?.where ?? {}) as Row).OR as Row[]) ?? [];
        return partner.edges.filter((edge) =>
          terms.some((term) =>
            ("partnerAId" in term && edge.partnerAId === term.partnerAId) ||
            ("partnerBId" in term && edge.partnerBId === term.partnerBId),
          ),
        ).length;
      },
      create: async (args: Row) => {
        partner.writes.push({ kind: "create", ...args });
        return { id: "pp-baru", ...(args.data as Row) };
      },
      update: async (args: Row) => {
        partner.writes.push({ kind: "update", ...args });
        const id = (args.where as Row).id as string;
        const edge = partner.edges.find((row) => row.id === id) ?? { id };
        return { ...edge, ...(args.data as Row) };
      },
    },
    personPrivate: {
      findUnique: async () => null,
      upsert: async (args: Row) => { upserted.push(args); return args; },
    },
    auditLog: { create: async (args: Row) => { f.state.writes.push(args); return args; } },
    _created: created,
  });
  return { f, people, created, upserted, partner };
}

describe("Profile Relations API", () => {
  test("GET requires authentication", async () => {
    const { f } = relationsFixture(); f.state.session = null;
    const route = loadRoute("src/app/api/profil/relations/route.ts", f);
    assert.equal((await route.GET(new Request("http://localhost/api/profil/relations"))).status, 401);
    assert.equal(f.state.writes.length, 0);
  });

  test("GET returns honest empty relations without fabrication", async () => {
    const { f } = relationsFixture();
    // Akun ini belum punya relasi apa pun di graf.
    f.state.user = { personId: "p7" };
    const route = loadRoute("src/app/api/profil/relations/route.ts", f);
    const response = await route.GET(new Request("http://localhost/api/profil/relations"));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.relations.parents, []);
    assert.deepEqual(body.relations.ancestors, []);
    assert.deepEqual(body.relations.children, []);
    assert.deepEqual(body.relations.siblings, []);
    assert.deepEqual(body.relations.partners, []);
  });

  test("GET labels ancestors in Javanese and sorts children oldest first", async () => {
    const { f } = relationsFixture();
    const route = loadRoute("src/app/api/profil/relations/route.ts", f);
    const response = await route.GET(new Request("http://localhost/api/profil/relations"));
    assert.equal(response.status, 200);
    const { relations } = await response.json();
    assert.equal(relations.parents.length, 1);
    assert.equal(relations.parents[0].role, "FATHER");
    assert.equal(relations.ancestors[0].label, "Kakek");
    assert.equal(relations.ancestors[0].depth, 2);
    assert.deepEqual(relations.children.map((c: Row) => c.id), ["p6", "p5"]);
    assert.equal(relations.children[0].birthDate !== null, true);
  });

  test("GET searches only same-branch candidates", async () => {
    const { f } = relationsFixture();
    const route = loadRoute("src/app/api/profil/relations/route.ts", f);
    const response = await route.GET(new Request("http://localhost/api/profil/relations?q=ayah"));
    assert.equal(response.status, 200);
    const { candidates } = await response.json();
    assert.deepEqual(candidates.map((c: Row) => c.id), ["p2"]);
    assert.equal(candidates.some((c: Row) => c.id === "p1"), false);
    assert.equal(candidates.some((c: Row) => c.id === "p3"), false);
  });

  test("POST requires authentication", async () => {
    const { f } = relationsFixture(); f.state.session = null;
    const route = loadRoute("src/app/api/profil/relations/route.ts", f);
    assert.equal((await route.POST(request("POST", { action: "setParent", personId: "p2", role: "FATHER" }))).status, 401);
    assert.equal(f.state.writes.length, 0);
  });

  test("POST refuses to edit another member profile", async () => {
    const { f, upserted } = relationsFixture();
    const route = loadRoute("src/app/api/profil/relations/route.ts", f);
    const response = await route.POST(request("POST", { action: "setParent", personId: "p2", role: "FATHER", profileId: "p9" }));
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error, "Anda hanya dapat mengubah profil sendiri");
    assert.equal(upserted.length, 0);
  });

  test("POST links a same-branch father as a PersonChild edge", async () => {
    const { f, upserted } = relationsFixture();
    const route = loadRoute("src/app/api/profil/relations/route.ts", f);
    const response = await route.POST(request("POST", { action: "setParent", personId: "p2", role: "FATHER" }));
    assert.equal(response.status, 200);
    const compound = (upserted[0].where as Row).parentId_childId as Row;
    assert.equal(compound.parentId, "p2");
    assert.equal(compound.childId, "p1");
    assert.equal((upserted[0].create as Row).parentRole, "FATHER");
  });

  test("POST rejects a parent from another branch", async () => {
    const { f, upserted } = relationsFixture();
    const route = loadRoute("src/app/api/profil/relations/route.ts", f);
    const response = await route.POST(request("POST", { action: "setParent", personId: "p3", role: "FATHER" }));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "Orang tua harus dari cabang keluarga yang sama");
    assert.equal(upserted.length, 0);
  });

  test("POST saves spouse, marriage place and marital status", async () => {
    const { f, upserted, partner } = relationsFixture();
    const route = loadRoute("src/app/api/profil/relations/route.ts", f);
    const response = await route.POST(request("POST", {
      action: "setPartner",
      personId: "p7",
      maritalStatus: "MENIKAH",
      marriageDate: "1995-06-10",
      marriagePlace: "Surakarta",
    }));
    assert.equal(response.status, 200);
    const create = partner.writes.find((write) => write.kind === "create");
    assert.ok(create);
    const data = create!.data as Row;
    assert.equal(data.partnerAId, "p1");
    assert.equal(data.partnerBId, "p7");
    assert.equal(data.notes, "Surakarta");
    assert.equal(data.status, "MARRIED");
    const privateUpsert = upserted.find((u) => (u.where as Row).personId === "p1");
    assert.ok(privateUpsert);
    assert.equal((privateUpsert!.update as Row).maritalStatus, "MENIKAH");
  });

  test("POST setPartner tidak menggandakan pasangan berurutan terbalik", async () => {
    const { f, partner } = relationsFixture();
    partner.edges.push({ id: "pp-lama", partnerAId: "p7", partnerBId: "p1", orderIndex: 0, status: "MARRIED", marriageDate: null, notes: null });
    const route = loadRoute("src/app/api/profil/relations/route.ts", f);
    const response = await route.POST(request("POST", { action: "setPartner", personId: "p7", maritalStatus: "MENIKAH" }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).edgeId, "pp-lama");
    assert.equal(partner.writes.filter((write) => write.kind === "create").length, 0);
    assert.equal(partner.writes.filter((write) => write.kind === "update").length, 1);
    assert.equal((partner.writes[0].where as Row).id, "pp-lama");
  });

  test("GET memakai label keturunan adat Jawa", async () => {
    const { f } = relationsFixture();
    const route = loadRoute("src/app/api/profil/relations/route.ts", f);
    const response = await route.GET(new Request("http://localhost/api/profil/relations"));
    assert.equal(response.status, 200);
    const { relations } = await response.json();
    const depthTwo = relations.descendants.find((row: Row) => row.depth === 2);
    assert.ok(depthTwo, "cucu p8 harus muncul sebagai keturunan depth 2");
    assert.equal(depthTwo!.label, "Putu / Wayah");
  });

  test("GET menampilkan satu baris per pasangan walau edge duplikat", async () => {
    const { f, people, partner } = relationsFixture();
    partner.edges.push(
      { id: "pp1", partnerAId: "p1", partnerBId: "p7", orderIndex: 0, status: "MARRIED", marriageDate: null, notes: null, partnerA: people.p1, partnerB: people.p7 },
      { id: "pp2", partnerAId: "p7", partnerBId: "p1", orderIndex: 1, status: "MARRIED", marriageDate: null, notes: null, partnerA: people.p1, partnerB: people.p7 },
    );
    const route = loadRoute("src/app/api/profil/relations/route.ts", f);
    const response = await route.GET(new Request("http://localhost/api/profil/relations"));
    assert.equal(response.status, 200);
    const { relations } = await response.json();
    assert.equal(relations.partners.length, 1);
    assert.equal(relations.partners[0].id, "p7");
  });

  test("POST returns 400 for malformed JSON", async () => {
    const { f } = relationsFixture();
    const route = loadRoute("src/app/api/profil/relations/route.ts", f);
    const response = await route.POST(new Request("http://localhost/api/profil/relations", { method: "POST", body: "{", headers: { "Content-Type": "application/json" } }));
    assert.equal(response.status, 400);
    assert.equal(f.state.writes.length, 0);
  });
});

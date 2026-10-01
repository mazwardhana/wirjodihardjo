import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAncestorLevels,
  buildDescendantLevels,
  getAncestorLabel,
  getFamilyTreeData,
  toSiblingSections,
  type SiblingSection,
  type TreeDb,
  type TreeMember,
} from "./family-tree";
import { AuthorizationError, type AdminScope } from "@/lib/rbac";
import type { SiblingGroup } from "@/lib/genealogy";

// ── fixture pohon kecil: kakek/nenek -> ayah -> anak + 2 saudara ──────────
function memberRow(id: string, fullName: string, gender: string): TreeMember {
  return {
    id,
    fullName,
    nickname: null,
    namaPanggilan: null,
    photoUrl: null,
    gender,
    generationLevel: null,
    isDeceased: false,
  };
}

const MEMBERS: Record<string, TreeMember> = {
  K: memberRow("K", "Kakek Slamet", "MALE"),
  N: memberRow("N", "Nenek Siti", "FEMALE"),
  A: memberRow("A", "Ayah Budi", "MALE"),
  C: memberRow("C", "Anak Cahya", "FEMALE"),
  S1: memberRow("S1", "Saudara Dedi", "MALE"),
  S2: memberRow("S2", "Saudara Rina", "FEMALE"),
};

const PARENTS_OF = new Map<string, string[]>([
  ["A", ["K", "N"]],
  ["C", ["A"]],
  ["S1", ["A"]],
  ["S2", ["A"]],
]);

const CHILDREN_OF = new Map<string, string[]>([
  ["K", ["A"]],
  ["N", ["A"]],
  ["A", ["C", "S1", "S2"]],
]);

const memberMap = new Map<string, TreeMember>(Object.entries(MEMBERS));

// ── getAncestorLabel ─────────────────────────────────────────────────────

test("getAncestorLabel memakai label adat Jawa berurutan", () => {
  assert.equal(getAncestorLabel(1), "Orang Tua");
  assert.equal(getAncestorLabel(2), "Kakek/Nenek");
  assert.equal(getAncestorLabel(3), "Buyut");
  assert.equal(getAncestorLabel(4), "Canggah");
  assert.equal(getAncestorLabel(5), "Wareng");
  assert.equal(getAncestorLabel(6), "Udheg-udheg");
  assert.equal(getAncestorLabel(7), "Gantung siwur");
  assert.equal(getAncestorLabel(8), "Gropak senthe");
});

test("getAncestorLabel membedakan gender di tingkat 1 dan 2", () => {
  assert.equal(getAncestorLabel(1, "MALE"), "Ayah");
  assert.equal(getAncestorLabel(1, "FEMALE"), "Ibu");
  assert.equal(getAncestorLabel(2, "MALE"), "Kakek");
  assert.equal(getAncestorLabel(2, "FEMALE"), "Nenek");
});

test("getAncestorLabel fallback untuk tingkat di luar daftar", () => {
  assert.equal(getAncestorLabel(0), "Generasi ke-0");
  assert.equal(getAncestorLabel(99), "Generasi ke-99");
});

// ── buildAncestorLevels ──────────────────────────────────────────────────

test("buildAncestorLevels menyusun rantai leluhur berlabel adat Jawa", () => {
  const levels = buildAncestorLevels("C", PARENTS_OF, memberMap);

  assert.equal(levels.length, 2);

  assert.equal(levels[0].level, 1);
  assert.equal(levels[0].label, "Orang Tua");
  assert.equal(levels[0].members.length, 1);
  assert.equal(levels[0].members[0].id, "A");
  assert.equal(levels[0].members[0].label, "Ayah");

  assert.equal(levels[1].level, 2);
  assert.equal(levels[1].label, "Kakek/Nenek");
  assert.deepEqual(
    levels[1].members.map((m) => [m.id, m.label]),
    [["K", "Kakek"], ["N", "Nenek"]],
  );
});

test("buildAncestorLevels menampilkan (Kosong) sebagai level kosong", () => {
  const levels = buildAncestorLevels("C", new Map([["C", []]]), memberMap);
  assert.equal(levels.length, 1);
  assert.equal(levels[0].level, 1);
  assert.equal(levels[0].label, "Orang Tua");
  assert.equal(levels[0].members.length, 0);
});

test("buildAncestorLevels tidak loop pada graf melingkar", () => {
  const cyclic = new Map<string, string[]>([["C", ["A"]], ["A", ["C"]]]);
  const levels = buildAncestorLevels("C", cyclic, memberMap);
  assert.equal(levels.length, 1);
  assert.equal(levels[0].members[0]?.id, "A");
});

// ── buildDescendantLevels ────────────────────────────────────────────────

test("buildDescendantLevels menurunkan generasi berlabel adat", () => {
  const levels = buildDescendantLevels("A", CHILDREN_OF, memberMap);
  assert.equal(levels.length, 1);
  assert.equal(levels[0].level, 1);
  assert.equal(levels[0].label, "Anak");
  assert.deepEqual(
    levels[0].members.map((m) => m.id),
    ["C", "S1", "S2"],
  );
});

test("buildDescendantLevels menghitung tingkat kedua", () => {
  const levels = buildDescendantLevels("C", CHILDREN_OF, memberMap);
  assert.equal(levels.length, 1);
  assert.equal(levels[0].members.length, 0);
});

// ── toSiblingSections ────────────────────────────────────────────────────

test("toSiblingSections memakai label saudara dari genealogy", () => {
  const groups: SiblingGroup[] = [
    {
      type: "FULL",
      label: "Sedulur",
      description: "Saudara kandung",
      members: [MEMBERS.C, MEMBERS.S1] as never,
    },
    {
      type: "PATERNAL_HALF",
      label: "Sedulur kuwalon",
      description: "Sebapak beda ibu",
      members: [MEMBERS.S2] as never,
    },
    { type: "STEP", label: "Sedulur tiri", description: "Tiri", members: [] },
  ];

  const sections = toSiblingSections(groups) as SiblingSection[];

  assert.equal(sections.length, 2);
  assert.equal(sections[0].type, "FULL");
  assert.equal(sections[0].label, "Sedulur");
  assert.equal(sections[0].members.length, 2);
  assert.equal(sections[1].label, "Sedulur kuwalon");
  assert.equal(sections[1].members.length, 1);
});

// ── getFamilyTreeData ────────────────────────────────────────────────────

function makeFixtureDb(
  personBranch: Record<string, string> = {},
  recorded?: { args?: unknown },
): TreeDb {
  const edges = [
    { id: "edge-p-1", parentId: "K", childId: "A" },
    { id: "edge-p-2", parentId: "N", childId: "A" },
    { id: "edge-c-1", parentId: "A", childId: "C" },
    { id: "edge-c-2", parentId: "A", childId: "S1" },
    { id: "edge-c-3", parentId: "A", childId: "S2" },
  ];

  const detail = (id: string) => {
    const base = MEMBERS[id];
    return {
      ...base,
      branchId: personBranch[id] ?? "b1",
      branch: { id: personBranch[id] ?? "b1", name: "Cabang 1", branchNumber: 1 },
      birthDate: new Date("1990-01-01T00:00:00.000Z"),
      birthPlace: "Yogyakarta",
      deathDate: null,
      deathPlace: null,
      occupation: "Petani",
      status: null,
      bio: null,
      isMarriedInto: false,
      private: {
        visibleToMembers: true,
        city: "Sleman",
        province: "DI Yogyakarta",
        addressLine: "Jl. Kaliurang 1",
        postalCode: "55581",
        phone: "08123456789",
        whatsapp: "628123456789",
        email: "c@x.id",
        maritalStatus: null,
      },
      education: [
        { id: "e1", institution: "UGM", degree: "S1", fieldOfStudy: "Teknik", startYear: 2010, endYear: 2014 },
      ],
      socialLinks: [{ id: "l1", url: "https://x.id", username: "cahya", platform: { name: "X" } }],
      parents: edges
        .filter((e) => e.childId === id)
        .map((e) => ({
          id: e.id,
          parentRole: "FATHER",
          isStep: false,
          isAdopted: false,
          parent: MEMBERS[e.parentId],
        })),
      children: edges
        .filter((e) => e.parentId === id)
        .map((e) => ({ id: e.id, isStep: false, isAdopted: false, child: MEMBERS[e.childId] })),
      partnershipsA: [{ id: "pp-1", status: "MARRIED", partnerB: MEMBERS.S1 }],
      partnershipsB: [{ id: "pp-2", status: "MARRIED", partnerA: MEMBERS.S2 }],
    };
  };

  return {
    person: {
      findUnique: async (args: { where: { id: string } }) => {
        if (recorded) recorded.args = args;
        const id = args.where.id;
        if (!MEMBERS[id]) return null;
        return detail(id) as never;
      },
      findMany: async (args: { where?: { id?: { in?: string[] } } }) => {
        const ids: string[] = args.where?.id?.in ?? [];
        return ids.filter((id) => MEMBERS[id]).map((id) => ({ ...MEMBERS[id] })) as never;
      },
    },
    personChild: {
      findMany: async (args: {
        where?: { childId?: { in?: string[] }; parentId?: { in?: string[] } };
      }) => {
        const childIn = args.where?.childId?.in;
        const parentIn = args.where?.parentId?.in;
        if (childIn) return edges.filter((e) => childIn.includes(e.childId)) as never;
        if (parentIn) return edges.filter((e) => parentIn.includes(e.parentId)) as never;
        return [] as never;
      },
    },
  };
}

function siblingsProvider(): Promise<SiblingGroup[]> {
  return Promise.resolve([
    {
      type: "FULL",
      label: "Sedulur",
      description: "Saudara kandung",
      members: [MEMBERS.S1, MEMBERS.S2] as never,
    },
  ]);
}

const SUPER_SCOPE: AdminScope = { role: "SUPER_ADMIN", branchId: null };
const BRANCH_SCOPE: AdminScope = { role: "BRANCH_ADMIN", branchId: "b1" };

test("getFamilyTreeData menyusun orang tua, leluhur, saudara, dan keturunan", async () => {
  const data = await getFamilyTreeData("C", SUPER_SCOPE, {
    db: makeFixtureDb(),
    siblingProvider: siblingsProvider,
  });

  assert.equal(data.person.id, "C");
  assert.equal(data.person.fullName, "Anak Cahya");
  assert.equal(data.person.birthDate, "1990-01-01T00:00:00.000Z");
  assert.equal(data.person.private?.city, "Sleman");
  assert.equal(data.branch?.id, "b1");

  assert.equal(data.ancestors.length, 2);
  assert.equal(data.ancestors[0].label, "Orang Tua");
  assert.equal(data.ancestors[0].members[0].id, "A");
  assert.equal(data.ancestors[1].label, "Kakek/Nenek");

  assert.equal(data.siblings.length, 1);
  assert.equal(data.siblings[0].label, "Sedulur");
  assert.deepEqual(
    data.siblings[0].members.map((m) => m.id),
    ["S1", "S2"],
  );

  assert.equal(data.descendants[0].label, "Anak");
  assert.equal(data.descendants[0].members.length, 0);

  assert.equal(data.parents.length, 1);
  assert.equal(data.parents[0].id, "A");
  assert.equal(data.children.length, 0);
});

test("BRANCH_ADMIN tidak dapat membaca anggota cabang lain (403)", async () => {
  await assert.rejects(
    () =>
      getFamilyTreeData("C", BRANCH_SCOPE, {
        db: makeFixtureDb({ C: "b2" }),
        siblingProvider: siblingsProvider,
      }),
    (err: unknown) => err instanceof AuthorizationError && err.status === 403,
  );
});

test("BRANCH_ADMIN dapat membaca anggota cabangnya sendiri", async () => {
  const data = await getFamilyTreeData("C", BRANCH_SCOPE, {
    db: makeFixtureDb({ C: "b1" }),
    siblingProvider: siblingsProvider,
  });
  assert.equal(data.person.id, "C");
});

test("getFamilyTreeData mengembalikan 404 bila anggota tidak ada", async () => {
  await assert.rejects(
    () =>
      getFamilyTreeData("missing", SUPER_SCOPE, {
        db: makeFixtureDb(),
        siblingProvider: siblingsProvider,
      }),
    (err: unknown) => err instanceof AuthorizationError && err.status === 404,
  );
});

// ── payload relasi: edgeId, pasangan, dan include ────────────────────────

test("getFamilyTreeData menyertakan edgeId pada setiap relasi", async () => {
  const data = await getFamilyTreeData("A", SUPER_SCOPE, {
    db: makeFixtureDb(),
    siblingProvider: siblingsProvider,
  });

  assert.equal(data.parents.length, 2);
  assert.equal(data.parents[0].edgeId, "edge-p-1");
  assert.equal(data.children.length, 3);
  assert.equal(data.children[0].edgeId, "edge-c-1");
});

test("getFamilyTreeData menyertakan pasangan dari kedua sisi partnership", async () => {
  const data = await getFamilyTreeData("A", SUPER_SCOPE, {
    db: makeFixtureDb(),
    siblingProvider: siblingsProvider,
  });

  assert.equal(data.partners.length, 2);
  assert.equal(data.partners[0].edgeId, "pp-1");
  assert.equal(data.partners[0].member.id, MEMBERS.S1.id);
  assert.equal(data.partners[1].edgeId, "pp-2");
  assert.equal(data.partners[1].member.id, MEMBERS.S2.id);
});

test("getFamilyTreeData memanggil findUnique dengan include relasi", async () => {
  const recorded: { args?: unknown } = {};

  await getFamilyTreeData("A", SUPER_SCOPE, {
    db: makeFixtureDb({}, recorded),
    siblingProvider: siblingsProvider,
  });

  assert.ok((recorded.args as { include?: Record<string, unknown> }).include);
  const include = (recorded.args as { include: Record<string, unknown> }).include;
  for (const key of ["parents", "children", "branch", "partnershipsA", "partnershipsB"]) {
    assert.ok(key in include, `field ${key} wajib di-include`);
  }
});

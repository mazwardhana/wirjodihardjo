import assert from "node:assert/strict";
import test from "node:test";
import {
  countPublicMembers,
  getPublicMembers,
  genderLabel,
  genderShort,
  REGISTRY_PAGE_SIZE,
  type RegistryDb,
  type RegistryGender,
} from "./registrasi-registry";

type FakePerson = {
  id: string;
  fullName: string;
  namaPanggilan: string | null;
  gender: RegistryGender;
  registrationBatchId: string | null;
  deletedAt: Date | null;
  branchId: string | null;
  branch: { name: string; branchNumber: number } | null;
};

function person(overrides: Partial<FakePerson> = {}): FakePerson {
  return {
    id: "p1",
    fullName: "Budi Santoso",
    namaPanggilan: "Budi",
    gender: "MALE",
    registrationBatchId: null,
    deletedAt: null,
    branchId: "b1",
    branch: { name: "Keluarga Soedjinah", branchNumber: 1 },
    ...overrides,
  };
}

const BRANCHES = [
  { id: "b1", name: "Keluarga Soedjinah", branchNumber: 1 },
  { id: "b2", name: "Keluarga Suwito", branchNumber: 2 },
];

function fakeDb(people: FakePerson[]): RegistryDb {
  return {
    person: {
      count: async (args: { where?: Record<string, unknown> }) =>
        applyWhere(people, args.where).length,
      findMany: async (args: {
        where?: Record<string, unknown>;
        skip?: number;
        take?: number;
      }) => {
        const matched = applyWhere(people, args.where);
        const start = args.skip ?? 0;
        return matched.slice(start, start + (args.take ?? matched.length));
      },
    },
    branch: { findMany: async () => BRANCHES },
  } as unknown as RegistryDb;
}

/** Meniru penyaringan Prisma yang dipakai modul: deletedAt, branchId, q, OR nama. */
function applyWhere(people: FakePerson[], where: Record<string, unknown> = {}): FakePerson[] {
  return people.filter((p) => {
    if ("deletedAt" in where && where.deletedAt === null && p.deletedAt !== null) return false;
    if (typeof where.branchId === "string" && p.branchId !== where.branchId) return false;
    const or = where.OR as Array<Record<string, { contains: string }>> | undefined;
    if (or) {
      const q = or[0]?.fullName?.contains?.toLowerCase() ?? "";
      const haystack = `${p.fullName} ${p.namaPanggilan ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

test("semua anggota tampil, termasuk yang bukan dari registrasi", async () => {
  const result = await getPublicMembers(
    fakeDb([person(), person({ id: "p2" })]),
  );
  assert.equal(result.total, 2);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].fromRegistration, false);
});

test("baris dari registrasi ditandai fromRegistration", async () => {
  const db = fakeDb([person({ registrationBatchId: "batch-9" })]);
  const result = await getPublicMembers(db);
  assert.equal(result.rows[0].fromRegistration, true);
});

test("pencarian nama menyaring nama lengkap dan nama panggilan", async () => {
  const db = fakeDb([
    person({ id: "a", fullName: "Budi Santoso", namaPanggilan: "Budi" }),
    person({ id: "b", fullName: "Siti Rahayu", namaPanggilan: "Siti" }),
  ]);
  const result = await getPublicMembers(db, { q: "siti" });
  assert.equal(result.total, 1);
  assert.equal(result.rows[0].fullName, "Siti Rahayu");
});

test("filter cabang hanya mengembalikan anggota cabang itu", async () => {
  const db = fakeDb([
    person({ id: "a", branchId: "b1" }),
    person({ id: "b", branchId: "b2", branch: { name: "Keluarga Suwito", branchNumber: 2 } }),
  ]);
  const result = await getPublicMembers(db, { branchId: "b2" });
  assert.equal(result.total, 1);
  assert.equal(result.rows[0].branchName, "Keluarga Suwito");
});

test("paginasi memotong hasil dan total tetap utuh", async () => {
  const people = Array.from({ length: 25 }, (_, i) => person({ id: `p${i}` }));
  const db = fakeDb(people);
  const page1 = await getPublicMembers(db, { pageSize: 20, page: 1 });
  const page2 = await getPublicMembers(db, { pageSize: 20, page: 2 });
  assert.equal(page1.total, 25);
  assert.equal(page1.rows.length, 20);
  assert.equal(page2.rows.length, 5);
});

test("pageSize bawaan dan pembatasan nilai ekstrem", async () => {
  const db = fakeDb([person()]);
  const dflt = await getPublicMembers(db);
  assert.equal(dflt.pageSize, REGISTRY_PAGE_SIZE);
  const huge = await getPublicMembers(db, { pageSize: 9999 });
  assert.equal(huge.pageSize, 100);
  const zero = await getPublicMembers(db, { pageSize: 0 });
  assert.equal(zero.pageSize, REGISTRY_PAGE_SIZE);
});

test("angka bukan valid dianggap halaman 1", async () => {
  const db = fakeDb([person()]);
  const result = await getPublicMembers(db, { page: Number.NaN });
  assert.equal(result.page, 1);
});

test("label jenis kelamin", () => {
  assert.equal(genderLabel("MALE"), "Laki-laki");
  assert.equal(genderLabel("FEMALE"), "Perempuan");
  assert.equal(genderLabel("OTHER"), "Lainnya");
  assert.equal(genderShort("MALE"), "L");
  assert.equal(genderShort("FEMALE"), "P");
  assert.equal(genderShort("OTHER"), "—");
});

test("countPublicMembers menghitung anggota yang belum dihapus saja", async () => {
  const db = fakeDb([
    person(),
    person({ id: "p2" }),
    person({ id: "p3", deletedAt: new Date("2026-01-01") }),
  ]);
  // Kartu di halaman registrasi memakai angka ini, jadi angka yang dihapus
  // tidak boleh ikut terhitung.
  assert.equal(await countPublicMembers(db), 2);
});

test("countPublicMembers tidak menyaring apa pun selain deletedAt", async () => {
  let seen: unknown = null;
  const db = {
    person: {
      count: async (args: unknown) => {
        seen = args;
        return 0;
      },
      findMany: async () => [],
    },
    branch: { findMany: async () => [] },
  } as unknown as RegistryDb;

  assert.equal(await countPublicMembers(db), 0);
  assert.deepEqual(
    seen,
    { where: { deletedAt: null } },
    "tanpa branchId maupun OR nama: yang dihitung buku besar seluruhnya",
  );
});

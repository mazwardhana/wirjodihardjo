import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getFamilyStats,
  getBranchStats,
  getReunionStats,
  getRegistrationStats,
  getStatistics,
  getRegistrationCredentials,
  type StatisticsDb,
} from "./statistik";

type Person = { branchId: string | null; isDeceased: boolean; gender: "MALE" | "FEMALE" | "OTHER" };

function countFrom(persons: Person[], where: Record<string, unknown> = {}): number {
  return persons.filter((p) => {
    for (const [key, value] of Object.entries(where)) {
      if (key === "deletedAt") continue;
      if (p[key as keyof Person] !== value) return false;
    }
    return true;
  }).length;
}

function fakeDb(people: Person[], options: { reunion?: unknown; regs?: Array<{ status: string; guestCount: number }> } = {}) {
  const branchRows = [
    { id: "b1", name: "Keluarga Soedjinah", slug: "keluarga-soedjinah", branchNumber: 1 },
    { id: "b2", name: "Keluarga Suwito", slug: "keluarga-suwito", branchNumber: 2 },
  ];
  const regs = options.regs ?? [];

  return {
    person: {
      count: async (args: { where?: Record<string, unknown> }) => countFrom(people, args.where),
      groupBy: async (args: { by: string[]; where?: Record<string, unknown> }) => {
        const keys = args.by.filter((k) => k !== "deletedAt");
        const buckets = new Map<string, { row: Record<string, unknown>; n: number }>();
        for (const p of people) {
          const signature = keys.map((k) => String(p[k as keyof Person])).join("|");
          const row: Record<string, unknown> = {};
          for (const k of keys) row[k] = p[k as keyof Person];
          const existing = buckets.get(signature);
          if (existing) existing.n += 1;
          else buckets.set(signature, { row, n: 1 });
        }
        return [...buckets.values()].map(({ row, n }) => ({ ...row, _count: { _all: n } }));
      },
      aggregate: async () => ({ _count: { _all: people.length } }),
    },
    branch: { findMany: async () => branchRows },
    reunion: {
      findUnique: async () =>
        options.reunion === undefined
          ? null
          : (options.reunion as Record<string, unknown> | null),
    },
    reunionRegistration: {
      aggregate: async (args: { where: { status: string } }) => ({
        _sum: {
          guestCount: regs
            .filter((r) => r.status === args.where.status)
            .reduce((s, r) => s + r.guestCount, 0),
        },
      }),
      findMany: async () => [],
    },
    registrationBatch: {
      aggregate: async () => ({
        _count: { _all: 3 },
        _sum: { rowCount: 10, accountsMade: 10, attendees: 6 },
      }),
      findFirst: async () => ({ submittedAt: new Date("2026-10-03") }),
    },
  } as unknown as StatisticsDb;
}

const sample: Person[] = [
  { branchId: "b1", isDeceased: false, gender: "MALE" },
  { branchId: "b1", isDeceased: true, gender: "MALE" },
  { branchId: "b1", isDeceased: false, gender: "FEMALE" },
  { branchId: "b2", isDeceased: false, gender: "FEMALE" },
  { branchId: null, isDeceased: false, gender: "MALE" },
];

test("jumlah anggota dipecah hidup, wafat, dan gender", async () => {
  const stats = await getFamilyStats(fakeDb(sample));
  assert.equal(stats.total, 5);
  assert.equal(stats.living, 4);
  assert.equal(stats.deceased, 1);
  assert.equal(stats.male, 3);
  assert.equal(stats.female, 2);
  assert.equal(stats.livingPercent, 80);
});

test("anggota tanpa cabang dihitung terpisah", async () => {
  const stats = await getFamilyStats(fakeDb(sample));
  assert.equal(stats.unassigned, 1);
});

test("sebaran per cabang mencakup seluruh cabang, termasuk yang kosong", async () => {
  const branches = await getBranchStats(fakeDb(sample));
  assert.equal(branches.length, 2);
  const [first, second] = branches;
  assert.equal(first.total, 3);
  assert.equal(first.deceased, 1);
  assert.equal(first.living, 2);
  assert.equal(second.total, 1);
});

test("tanpa event reuni, statistik tetap nol dan pendaftaran tertutup", async () => {
  const reunion = await getReunionStats(fakeDb(sample));
  assert.equal(reunion.title, null);
  assert.equal(reunion.attendeeCount, 0);
  assert.equal(reunion.registrationOpen, false);
});

test("reuni tanpa tanggal tetap membuka pendaftaran", async () => {
  const db = fakeDb(sample, {
    reunion: {
      id: "r1",
      title: "Reuni Wirjodihardjo 2.0 - Blitar, 2027",
      slug: "reuni-wirjodihardjo-2-0-blitar-2027",
      locationName: "Blitar",
      startAt: null,
      status: "PUBLISHED",
      capacity: null,
      registrationDeadline: null,
    },
    regs: [{ status: "CONFIRMED", guestCount: 3 }],
  });

  const reunion = await getReunionStats(db);
  assert.equal(reunion.registrationOpen, true);
  assert.equal(reunion.confirmedPeople, 3);
  assert.equal(reunion.attendeeCount, 3);
});

test("reuni yang sudah lewat menutup pendaftaran meski tanpa kuota", async () => {
  const db = fakeDb(sample, {
    reunion: {
      id: "r1",
      title: "Reuni Lama",
      slug: "reuni-wirjodihardjo-2-0-blitar-2027",
      locationName: "Blitar",
      startAt: new Date("2020-01-01"),
      status: "PUBLISHED",
      capacity: null,
      registrationDeadline: null,
    },
  });

  const reunion = await getReunionStats(db);
  assert.equal(reunion.registrationOpen, false);
});

test("peserta dihitung dari jumlah orang, bukan jumlah pendaftaran", async () => {
  const db = fakeDb(sample, {
    reunion: {
      id: "r1",
      title: "Reuni",
      slug: "reuni-wirjodihardjo-2-0-blitar-2027",
      locationName: "Blitar",
      startAt: null,
      status: "PUBLISHED",
      capacity: null,
      registrationDeadline: null,
    },
    regs: [
      { status: "CONFIRMED", guestCount: 2 },
      { status: "CONFIRMED", guestCount: 3 },
      { status: "WAITLIST", guestCount: 4 },
      { status: "CANCELLED", guestCount: 1 },
    ],
  });

  const reunion = await getReunionStats(db);
  assert.equal(reunion.confirmedPeople, 5);
  assert.equal(reunion.waitlistPeople, 4);
  assert.equal(reunion.attendeeCount, 9);
  assert.equal(reunion.cancelledPeople, 1);
});

test("batas pendaftaran yang lewat menutup pendaftaran", async () => {
  const db = fakeDb(sample, {
    reunion: {
      id: "r1",
      title: "Reuni",
      slug: "reuni-wirjodihardjo-2-0-blitar-2027",
      locationName: "Blitar",
      startAt: null,
      status: "PUBLISHED",
      capacity: null,
      registrationDeadline: new Date("2020-01-01"),
    },
  });

  const reunion = await getReunionStats(db);
  assert.equal(reunion.registrationOpen, false);
});

test("ringkasan batch registrasi dijumlahkan dari kolom _sum", async () => {
  const stats = await getRegistrationStats(fakeDb(sample));
  assert.equal(stats.batchCount, 3);
  assert.equal(stats.rowsSubmitted, 10);
  assert.equal(stats.accountsMade, 10);
  assert.equal(stats.attendeesFromForm, 6);
});

test("getStatistics menggabungkan keempat bagian", async () => {
  const bundle = await getStatistics(fakeDb(sample));
  assert.equal(bundle.family.total, 5);
  assert.equal(bundle.branches.length, 2);
  assert.equal(bundle.reunion.attendeeCount, 0);
  assert.equal(bundle.registration.batchCount, 3);
});

test("daftar kredensial memetakan nama dan cabang pemilik akun", async () => {
  const db = {
    user: {
      findMany: async () => [
        {
          id: "u1",
          username: "budi",
          isVerified: true,
          createdAt: new Date("2026-10-03"),
          person: { fullName: "Budi Santoso", branch: { name: "Keluarga Soedjinah" } },
        },
        {
          id: "u2",
          username: "siti",
          isVerified: true,
          createdAt: new Date("2026-10-03"),
          person: { fullName: "Siti Aminah", branch: null },
        },
      ],
    },
  } as never;

  const rows = await getRegistrationCredentials(db);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].fullName, "Budi Santoso");
  assert.equal(rows[0].branchName, "Keluarga Soedjinah");
  assert.equal(rows[1].branchName, null);
});
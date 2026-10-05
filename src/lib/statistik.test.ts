import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getFamilyStats,
  getBranchStats,
  getReunionStats,
  getRegistrationStats,
  getStatistics,
  getRegistrationCredentials,
  getReunionAttendanceByBranch,
  type StatisticsDb,
  type AttendanceDb,
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

/* ── Rekap kehadiran per keluarga cabang ── */

type RegRow = {
  attendance: string;
  status: string;
  personId: string | null;
  person: { branchId: string | null } | null;
  user: { person: { branchId: string | null } | null } | null;
};

function reg(overrides: Partial<RegRow> = {}): RegRow {
  return {
    attendance: "ATTENDING",
    status: "CONFIRMED",
    personId: "p1",
    person: { branchId: "b1" },
    user: null,
    ...overrides,
  };
}

const ATTENDANCE_BRANCHES = [
  { id: "b1", name: "Keluarga Soedjinah", branchNumber: 1 },
  { id: "b2", name: "Keluarga Suwito", branchNumber: 2 },
  { id: "b3", name: "Keluarga Suyatno", branchNumber: 3 },
];

function attendanceDb(
  regs: RegRow[],
  branches: Array<{ id: string; name: string; branchNumber: number | null }> = ATTENDANCE_BRANCHES,
) {
  return {
    branch: { findMany: async () => branches },
    reunionRegistration: {
      // Tiruan ini benar-benar menyaring `where` yang dikirim fungsi, sehingga
      // tes di bawah menguji kondisi query-nya, bukan hanya isi larinya.
      findMany: async (args: {
        where: { attendance: string; status: { not: string } };
      }) =>
        regs.filter(
          (r) =>
            r.attendance === args.where.attendance && r.status !== args.where.status.not,
        ),
    },
  } as unknown as AttendanceDb;
}

test("kehadiran hanya menghitung peserta berstatus ATTENDING", async () => {
  const result = await getReunionAttendanceByBranch(
    attendanceDb([
      reg({ personId: "p1", person: { branchId: "b1" } }),
      reg({ personId: "p2", person: { branchId: "b1" }, attendance: "NOT_ATTENDING" }),
      reg({ personId: "p3", person: { branchId: "b2" } }),
    ]),
    "r1",
  );
  assert.equal(result.rows[0].attending, 1);
  assert.equal(result.rows[1].attending, 1);
  assert.equal(result.total, 2);
});

test("pendaftaran yang dibatalkan tidak dihitung meski ditandai hadir", async () => {
  const result = await getReunionAttendanceByBranch(
    attendanceDb([
      reg({ personId: "p1", person: { branchId: "b1" }, status: "CANCELLED" }),
      reg({ personId: "p2", person: { branchId: "b1" }, status: "WAITLIST" }),
    ]),
    "r1",
  );
  assert.equal(result.rows[0].attending, 1);
  assert.equal(result.total, 1);
});

test("cabang tanpa peserta pun tetap dikembalikan", async () => {
  const result = await getReunionAttendanceByBranch(
    attendanceDb([reg({ personId: "p1", person: { branchId: "b1" } })]),
    "r1",
  );
  assert.deepEqual(
    result.rows.map((r) => [r.branchName, r.attending]),
    [
      ["Keluarga Soedjinah", 1],
      ["Keluarga Suwito", 0],
      ["Keluarga Suyatno", 0],
    ],
  );
});

test("peserta tanpa cabang dikumpulkan di baris tersendiri", async () => {
  const result = await getReunionAttendanceByBranch(
    attendanceDb([
      reg({ personId: "p1", person: null, user: null }),
      reg({ personId: "p2", person: { branchId: null }, user: null }),
    ]),
    "r1",
  );
  const last = result.rows[result.rows.length - 1];
  assert.equal(last.branchId, null);
  assert.equal(last.branchNumber, null);
  assert.equal(last.branchName, "Belum ditugaskan");
  assert.equal(last.attending, 2);
  assert.equal(result.total, 2);
});

test("baris tanpa cabang tidak muncul bila memang tidak ada", async () => {
  const result = await getReunionAttendanceByBranch(
    attendanceDb([reg({ personId: "p1", person: { branchId: "b1" } })]),
    "r1",
  );
  assert.equal(result.rows.length, 3);
  assert.ok(!result.rows.some((r) => r.branchId === null));
});

test("baris diurutkan menurut nomor cabang, bukan urutan balasan database", async () => {
  const result = await getReunionAttendanceByBranch(
    attendanceDb(
      [reg({ personId: "p1", person: { branchId: "b2" } })],
      [
        { id: "b2", name: "Keluarga Suwito", branchNumber: 2 },
        { id: "b1", name: "Keluarga Soedjinah", branchNumber: 1 },
      ],
    ),
    "r1",
  );
  assert.deepEqual(
    result.rows.map((r) => r.branchNumber),
    [1, 2],
  );
});

test("personId dipakai lebih dulu daripada profil akun peminjam", async () => {
  // `personId` menunjuk anggota cabang b1, sementara akun peminjamnya berasal
  // dari cabang lain. Yang dihitung adalah cabang dari `personId`.
  const result = await getReunionAttendanceByBranch(
    attendanceDb([
      reg({
        personId: "p1",
        person: { branchId: "b1" },
        user: { person: { branchId: "b2" } },
      }),
    ]),
    "r1",
  );
  assert.equal(result.rows[0].attending, 1);
  assert.equal(result.rows[1].attending, 0);
});

test("pendaftaran lama tanpa personId memakai cabang profil akun", async () => {
  const result = await getReunionAttendanceByBranch(
    attendanceDb([
      reg({ personId: null, person: null, user: { person: { branchId: "b2" } } }),
    ]),
    "r1",
  );
  assert.equal(result.rows[0].attending, 0);
  assert.equal(result.rows[1].attending, 1);
  assert.equal(result.total, 1);
});

test("rekap kosong tetap memuat seluruh cabang dengan angka nol", async () => {
  const result = await getReunionAttendanceByBranch(attendanceDb([]), "r1");
  assert.deepEqual(result.rows, [
    { branchId: "b1", branchName: "Keluarga Soedjinah", branchNumber: 1, attending: 0 },
    { branchId: "b2", branchName: "Keluarga Suwito", branchNumber: 2, attending: 0 },
    { branchId: "b3", branchName: "Keluarga Suyatno", branchNumber: 3, attending: 0 },
  ]);
  assert.equal(result.total, 0);
});
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Gender } from "@prisma/client";
import type { ParsedRegistrasi, RegistrasiImportRow } from "./types";

// ── Mock batas database ───────────────────────────────────────────────────────
// `analyzeRegistrasiImport` menerima `db`, jadi tes memakai objek palsu dan
// merekam argumen query untuk memverifikasi bentuk `where`.

type PersonRow = { branchId: string | null; fullName: string };
type UserRow = { username: string };

type FindManyArgs = { where?: Record<string, unknown>; select?: Record<string, unknown> };

function makeDb(people: PersonRow[], users: UserRow[]) {
  const personCalls: FindManyArgs[] = [];
  const userCalls: FindManyArgs[] = [];
  const db = {
    person: {
      async findMany(args: FindManyArgs) {
        personCalls.push(args);
        return people;
      },
    },
    user: {
      async findMany(args: FindManyArgs) {
        userCalls.push(args);
        return users;
      },
    },
  };
  return { db, personCalls, userCalls };
}

function row(overrides: Partial<RegistrasiImportRow> = {}): RegistrasiImportRow {
  return {
    _row: 2,
    cabangKe: "1",
    namaPanggilan: "Budi",
    namaLengkap: "Budi Santoso",
    gender: "L",
    status: "hidup",
    hadir: "ya",
    branchId: "b1",
    branchNumber: 1,
    branchName: "Cabang Satu",
    genderResolved: "MALE" as Gender,
    isDeceased: false,
    willAttend: true,
    ...overrides,
  };
}

function parsed(...items: RegistrasiImportRow[]): ParsedRegistrasi {
  return { rows: items };
}

async function analyze(
  db: ReturnType<typeof makeDb>["db"],
  data: ParsedRegistrasi,
  reunionId: string | null = null,
) {
  const { analyzeRegistrasiImport } = await import("./analyze");
  return analyzeRegistrasiImport(db, data, reunionId);
}

describe("analyzeRegistrasiImport", () => {
  test("skips a person already present in the database for the same branch", async () => {
    const { db } = makeDb([{ branchId: "b1", fullName: "Budi Santoso" }], []);
    const result = await analyze(db, parsed(row()));
    assert.strictEqual(result.counts.total, 1);
    assert.strictEqual(result.counts.personsCreated, 0);
    assert.strictEqual(result.counts.accountsCreated, 0);
    assert.strictEqual(result.counts.rowsSkipped, 1);
    assert.strictEqual(result.skipped.length, 1);
    assert.strictEqual(result.skipped[0].reason, "sudah ada, dilewati");
    assert.strictEqual(result.skipped[0].branchNumber, 1);
    assert.strictEqual(result.groups.length, 0);
  });

  test("existing person in a different branch is not a duplicate", async () => {
    const { db } = makeDb([{ branchId: "b2", fullName: "Budi Santoso" }], []);
    const result = await analyze(db, parsed(row()));
    assert.strictEqual(result.counts.personsCreated, 1);
    assert.strictEqual(result.counts.rowsSkipped, 0);
  });

  test("person lookup filters by branch and active (deletedAt null) and normalizes names", async () => {
    const { db, personCalls } = makeDb([{ branchId: "b1", fullName: "  BUDI   santoso " }], []);
    const result = await analyze(db, parsed(row()));
    assert.strictEqual(result.counts.rowsSkipped, 1, "normalisasi nama harus mencocokkan");
    const where = personCalls[0].where as Record<string, unknown>;
    assert.deepStrictEqual(where.branchId, { in: ["b1"] });
    assert.strictEqual(where.deletedAt, null);
  });

  test("in-file duplicate keys are skipped, only the first is kept", async () => {
    const { db } = makeDb([], []);
    const result = await analyze(
      db,
      parsed(
        row({ _row: 2, namaLengkap: "Budi Santoso" }),
        row({ _row: 3, namaLengkap: "budi  santoso" }),
      ),
    );
    assert.strictEqual(result.counts.total, 2);
    assert.strictEqual(result.counts.personsCreated, 1);
    assert.strictEqual(result.counts.rowsSkipped, 1);
    assert.strictEqual(result.skipped[0].fullName, "budi  santoso");
  });

  test("plans a numeric suffix username when the base is already taken", async () => {
    const { db, userCalls } = makeDb([], [{ username: "budi" }]);
    const result = await analyze(db, parsed(row()));
    assert.strictEqual(result.plannedUsernames["b1::budi santoso"], "budi-2");
    assert.strictEqual(result.credentials.find((c) => c.status === "dibuat")!.username, "budi-2");
    const where = userCalls[0].where as { OR: { username: { startsWith: string } }[] };
    assert.ok(where.OR.some((clause) => clause.username.startsWith === "budi"));
  });

  test("shared taken set keeps cross-branch usernames unique", async () => {
    const { db } = makeDb([], []);
    const result = await analyze(
      db,
      parsed(
        row({ _row: 2, branchId: "b1", branchNumber: 1, branchName: "Satu", namaLengkap: "Budi Santoso" }),
        row({ _row: 3, branchId: "b2", branchNumber: 2, branchName: "Dua", namaLengkap: "Budi Santoso" }),
      ),
    );
    const usernames = Object.values(result.plannedUsernames);
    assert.deepStrictEqual(usernames, ["budi", "budi-2"]);
  });

  test("groups rows by branch in first-seen order", async () => {
    const { db } = makeDb([], []);
    const result = await analyze(
      db,
      parsed(
        row({ _row: 2, branchId: "b2", branchNumber: 2, branchName: "Dua", namaLengkap: "Orang Dua" }),
        row({ _row: 3, branchId: "b1", branchNumber: 1, branchName: "Satu", namaLengkap: "Orang Satu" }),
        row({ _row: 4, branchId: "b2", branchNumber: 2, branchName: "Dua", namaLengkap: "Orang Dua Lain" }),
      ),
    );
    assert.deepStrictEqual(
      result.groups.map((g) => g.branchId),
      ["b2", "b1"],
    );
    assert.deepStrictEqual(
      result.groups.map((g) => g.rows.map((r) => r.namaLengkap)),
      [
        ["Orang Dua", "Orang Dua Lain"],
        ["Orang Satu"],
      ],
    );
    const groupRow = result.groups[0].rows[0];
    assert.deepStrictEqual(Object.keys(groupRow).sort(), [
      "gender",
      "hadir",
      "index",
      "isDeceased",
      "namaLengkap",
      "namaPanggilan",
    ]);
    assert.strictEqual(groupRow.gender, "MALE");
  });

  test("attendeesPlanned counts only kept rows that are living and hadir", async () => {
    const { db } = makeDb([], []);
    const result = await analyze(
      db,
      parsed(
        row({ _row: 2, namaLengkap: "Hidup Hadir", status: "hidup", hadir: "ya", isDeceased: false, willAttend: true }),
        row({ _row: 3, namaLengkap: "Hidup Tidak", status: "hidup", hadir: "tidak", isDeceased: false, willAttend: false }),
        row({ _row: 4, namaLengkap: "Wafat Hadir", status: "wafat", hadir: "ya", isDeceased: true, willAttend: false }),
      ),
    );
    assert.strictEqual(result.counts.total, 3);
    assert.strictEqual(result.counts.personsCreated, 3);
    assert.strictEqual(result.counts.accountsCreated, 3);
    assert.strictEqual(result.counts.attendeesPlanned, 1);
  });

  test("rows without a resolved branch are ignored entirely", async () => {
    const { db } = makeDb([], []);
    const result = await analyze(
      db,
      parsed(row({ branchId: undefined, branchNumber: undefined, genderResolved: undefined })),
    );
    assert.strictEqual(result.counts.total, 0);
    assert.strictEqual(result.groups.length, 0);
    assert.strictEqual(result.credentials.length, 0);
  });

  test("credentials contain kept and skipped rows with correct status", async () => {
    const { db } = makeDb([{ branchId: "b1", fullName: "Budi Santoso" }], []);
    const result = await analyze(
      db,
      parsed(
        row({ _row: 2, namaLengkap: "Budi Santoso" }),
        row({ _row: 3, namaLengkap: "Siti Aminah", namaPanggilan: "Siti", genderResolved: "FEMALE" as Gender }),
      ),
    );
    const skipped = result.credentials.filter((c) => c.status === "sudah ada, dilewati");
    const dibuat = result.credentials.filter((c) => c.status === "dibuat");
    assert.strictEqual(skipped.length, 1);
    assert.strictEqual(skipped[0].username, "");
    assert.strictEqual(skipped[0].willAttend, false);
    assert.strictEqual(dibuat.length, 1);
    assert.strictEqual(dibuat[0].fullName, "Siti Aminah");
    assert.strictEqual(dibuat[0].rowKey, "b1::siti aminah");
    assert.strictEqual(dibuat[0].branchNumber, 1);
    assert.strictEqual(dibuat[0].branchName, "Cabang Satu");
    assert.strictEqual(dibuat[0].willAttend, true);
  });

  test("passes reunionId through", async () => {
    const { db } = makeDb([], []);
    const result = await analyze(db, parsed(row()), "reunion-1");
    assert.strictEqual(result.reunionId, "reunion-1");
  });
});

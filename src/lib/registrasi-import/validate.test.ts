import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { EXCLUDED_BRANCH_SLUG } from "@/lib/registrasi";
import type { ParsedRegistrasi, RegistrasiImportRow } from "./types";

// ── Mock batas database ───────────────────────────────────────────────────────
// `validateRegistrasiImport` menerima `db` sebagai argumen, jadi tes tidak perlu
// memasang Prisma global — cukup objek cabang palsu yang menghormati `where`.

type BranchRow = {
  id: string;
  name: string;
  branchNumber: number;
  slug: string;
  isActive?: boolean;
};

function makeDb(branches: BranchRow[]) {
  return {
    branch: {
      async findMany(args: { where?: Record<string, unknown> } = {}) {
        const where = args.where ?? {};
        return branches
          .filter((b) => (where.isActive === undefined ? true : b.isActive === where.isActive))
          .filter((b) => {
            const slugNot = (where.slug as { not?: string } | undefined)?.not;
            return slugNot === undefined ? true : b.slug !== slugNot;
          })
          .map((b) => ({ id: b.id, name: b.name, branchNumber: b.branchNumber, slug: b.slug }));
      },
    },
  };
}

function row(overrides: Partial<RegistrasiImportRow> = {}): RegistrasiImportRow {
  return {
    cabangKe: "1",
    namaPanggilan: "Budi",
    namaLengkap: "Budi Santoso",
    gender: "L",
    status: "hidup",
    hadir: "ya",
    ...overrides,
  };
}

function rows(...items: RegistrasiImportRow[]): ParsedRegistrasi {
  return { rows: items };
}

// Fungsi impor bertahan hanya setelah modul ada; dipanggil per-tes agar
// kegagalan pertama jelas (modul belum ditemukan) lalu berubah saat implementasi.
async function validate(db: ReturnType<typeof makeDb>, data: ParsedRegistrasi) {
  const { validateRegistrasiImport } = await import("./validate");
  return validateRegistrasiImport(db, data);
}

const BASE_BRANCHES: BranchRow[] = [
  { id: "b1", name: "Cabang Satu", branchNumber: 1, slug: "cabang-satu", isActive: true },
  { id: "b2", name: "Cabang Dua", branchNumber: 2, slug: "cabang-dua", isActive: true },
  { id: "suwito", name: "Keluarga Suwito", branchNumber: 7, slug: EXCLUDED_BRANCH_SLUG, isActive: true },
];

describe("validateRegistrasiImport", () => {
  test("resolves branch by numeric branchNumber", async () => {
    const result = await validate(makeDb(BASE_BRANCHES), rows(row({ cabangKe: "2" })));
    assert.strictEqual(result.valid, true, JSON.stringify(result.errors));
    assert.strictEqual(result.data.rows[0].branchId, "b2");
    assert.strictEqual(result.data.rows[0].branchNumber, 2);
    assert.strictEqual(result.data.rows[0].branchName, "Cabang Dua");
  });

  test("resolves branch by case-insensitive name when not a number", async () => {
    const result = await validate(makeDb(BASE_BRANCHES), rows(row({ cabangKe: "  cabang dua " })));
    assert.strictEqual(result.valid, true, JSON.stringify(result.errors));
    assert.strictEqual(result.data.rows[0].branchId, "b2");
    assert.strictEqual(result.data.rows[0].branchNumber, 2);
  });

  test("unknown branch reports Indonesian not-found error", async () => {
    const result = await validate(makeDb(BASE_BRANCHES), rows(row({ _row: 7, cabangKe: "Tidak Ada" })));
    assert.strictEqual(result.valid, false);
    const branchError = result.errors.find((e) => e.sheet === "Registrasi" && e.row === 7);
    assert.ok(branchError, "harus ada error cabang pada baris 7");
    assert.strictEqual(branchError!.message, "Keluarga Cabang 'Tidak Ada' tidak ditemukan");
  });

  test("excluded Suwito branch is not resolvable", async () => {
    // Cabang Suwito ada di DB tapi dikecualikan lewat slug, sehingga baris yang
    // merujuknya (baik lewat nomor maupun nama) harus "tidak ditemukan".
    const byNumber = await validate(makeDb(BASE_BRANCHES), rows(row({ cabangKe: "7" })));
    assert.strictEqual(byNumber.valid, false);
    assert.ok(
      byNumber.errors.some((e) => e.message === "Keluarga Cabang '7' tidak ditemukan"),
      "nomor cabang Suwito harus tidak ditemukan",
    );

    const byName = await validate(makeDb(BASE_BRANCHES), rows(row({ cabangKe: "Keluarga Suwito" })));
    assert.strictEqual(byName.valid, false);
    assert.ok(byName.errors.some((e) => e.message === "Keluarga Cabang 'Keluarga Suwito' tidak ditemukan"));
  });

  test("missing gender and status produce row errors", async () => {
    const result = await validate(makeDb(BASE_BRANCHES), rows(row({ gender: "", status: "   " })));
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((e) => e.field === "gender" && e.message === "Pilih L atau P."));
    assert.ok(
      result.errors.some((e) => e.field === "status" && e.message === "Pilih status hidup atau wafat."),
    );
  });

  test("invalid gender/status (not OTHER fallback) produce errors", async () => {
    const result = await validate(makeDb(BASE_BRANCHES), rows(row({ gender: "UNKNOWN", status: "xxx" })));
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((e) => e.field === "gender" && e.message === "Pilih L atau P."));
    assert.ok(result.errors.some((e) => e.field === "status" && /status hidup atau wafat/.test(e.message)));
  });

  test("missing namaPanggilan and namaLengkap produce required errors", async () => {
    const result = await validate(makeDb(BASE_BRANCHES), rows(row({ namaPanggilan: "  ", namaLengkap: "" })));
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((e) => e.field === "nama_panggilan"));
    assert.ok(result.errors.some((e) => e.field === "nama_lengkap"));
  });

  test("max length enforced for namaPanggilan (100) and namaLengkap (200)", async () => {
    const result = await validate(
      makeDb(BASE_BRANCHES),
      rows(row({ namaPanggilan: "x".repeat(101), namaLengkap: "y".repeat(201) })),
    );
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((e) => e.field === "nama_panggilan" && /100/.test(e.message)));
    assert.ok(result.errors.some((e) => e.field === "nama_lengkap" && /200/.test(e.message)));
  });

  test("hadir variants: ya/y/1/true/hadir/yes -> true; tidak/t/0/false/no/empty -> false", async () => {
    const cases: Array<[string, boolean]> = [
      ["ya", true],
      ["y", true],
      ["1", true],
      ["true", true],
      ["hadir", true],
      ["yes", true],
      ["tidak", false],
      ["t", false],
      ["0", false],
      ["false", false],
      ["no", false],
      ["", false],
    ];
    const data = rows(...cases.map(([value], i) => row({ _row: i + 2, namaLengkap: `Orang ${i}`, hadir: value })));
    const result = await validate(makeDb(BASE_BRANCHES), data);
    assert.strictEqual(result.valid, true, JSON.stringify(result.errors));
    for (const [i, [value, expected]] of cases.entries()) {
      assert.strictEqual(result.data.rows[i].willAttend, expected, `hadir '${value}'`);
    }
  });

  test("unknown hadir value warns and is treated as tidak", async () => {
    const result = await validate(makeDb(BASE_BRANCHES), rows(row({ _row: 4, hadir: "garbage" })));
    assert.strictEqual(result.valid, true, "warning tidak membuat baris invalid");
    assert.ok(result.warnings.some((w) => w.includes("Nilai hadir 'garbage'")));
    assert.strictEqual(result.data.rows[0].willAttend, false);
  });

  test("willAttend is !isDeceased && hadir; deceased with hadir is not attendee", async () => {
    const result = await validate(
      makeDb(BASE_BRANCHES),
      rows(
        row({ namaLengkap: "Hidup Hadir", status: "hidup", hadir: "ya" }),
        row({ namaLengkap: "Hidup Tidak", status: "hidup", hadir: "tidak" }),
        row({ namaLengkap: "Wafat Hadir", status: "wafat", hadir: "ya" }),
      ),
    );
    assert.strictEqual(result.valid, true, JSON.stringify(result.errors));
    assert.strictEqual(result.data.rows[0].isDeceased, false);
    assert.strictEqual(result.data.rows[0].willAttend, true);
    assert.strictEqual(result.data.rows[1].willAttend, false);
    assert.strictEqual(result.data.rows[2].isDeceased, true);
    assert.strictEqual(result.data.rows[2].willAttend, false);
  });

  test("row number falls back to index + 2 and normalized names are trimmed", async () => {
    const result = await validate(
      makeDb(BASE_BRANCHES),
      rows(row({ namaPanggilan: "  Budi  ", namaLengkap: "  Budi Santoso " })),
    );
    assert.strictEqual(result.valid, true, JSON.stringify(result.errors));
    const r = result.data.rows[0];
    assert.strictEqual(r._row, 2, "baris pertama tanpa _row memakai index+2");
    assert.strictEqual(r.namaPanggilan, "Budi");
    assert.strictEqual(r.namaLengkap, "Budi Santoso");
  });

  test("empty import reports empty-file error on nama_lengkap", async () => {
    const result = await validate(makeDb(BASE_BRANCHES), { rows: [] });
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.errors.length, 1);
    assert.strictEqual(result.errors[0].field, "nama_lengkap");
    assert.strictEqual(result.errors[0].message, "File impor kosong: tidak ada baris data.");
  });

  test("valid flag is true only when there are zero errors", async () => {
    const ok = await validate(makeDb(BASE_BRANCHES), rows(row()));
    assert.strictEqual(ok.valid, true);
    const bad = await validate(makeDb(BASE_BRANCHES), rows(row({ namaPanggilan: "" })));
    assert.strictEqual(bad.valid, false);
    assert.strictEqual(bad.valid, bad.errors.length === 0);
  });
});

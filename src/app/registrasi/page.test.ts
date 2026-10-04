import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

/* Registrasi adalah form publik: halaman server hanya memuat daftar keluarga
   besar lalu meneruskannya ke komponen client. Test ini memuat kedua berkas
   lewat transpile + vm (pola yang sama dengan test galeri) supaya tidak
   butuh lingkungan Next, dan menguji helper murni form secara langsung. */

const PAGE_FILE = resolve("src/app/registrasi/page.tsx");
const FORM_FILE = resolve("src/app/registrasi/RegistrasiForm.tsx");

const pageRequire = createRequire(PAGE_FILE);

type Branch = { id: string; name: string; branchNumber: number };

const REUNI_TITLE = "Reuni Wirjodihardjo 2.0 - Blitar, 2027";

function transpile(filename: string): string {
  return ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
}

function branch(overrides: Partial<Branch> = {}): Branch {
  return { id: "b-1", name: "Keluarga Besar Wirjodihardjo 1", branchNumber: 1, ...overrides };
}

/* ── Halaman server ──────────────────────────────────────────── */

function loadPage(branches: Branch[]) {
  const prisma = { branch: { findMany: async () => branches } };
  const received: { branches: Branch[]; reuniTitle: string }[] = [];
  let dbArgument: unknown = null;

  const exports: Record<string, unknown> = {};
  runInNewContext(
    transpile(PAGE_FILE),
    {
      exports,
      require: (id: string) => {
        if (id === "@/lib/prisma") return { prisma };
        if (id === "@/lib/registrasi") {
          return {
            REUNI_2027_TITLE: REUNI_TITLE,
            getRegistrationBranches: async (db: { branch: { findMany: () => Promise<Branch[]> } }) => {
              dbArgument = db;
              return db.branch.findMany();
            },
          };
        }
        if (id === "./RegistrasiForm") {
          return {
            RegistrasiForm: (props: { branches: Branch[]; reuniTitle: string }) => {
              received.push({ branches: props.branches, reuniTitle: props.reuniTitle });
              return React.createElement(
                "div",
                { "data-form": "1" },
                `${props.branches.map((b) => b.name).join("|")}::${props.reuniTitle}`,
              );
            },
          };
        }
        return pageRequire(id);
      },
    },
    { filename: PAGE_FILE },
  );

  return {
    Page: exports.default as () => Promise<React.ReactElement>,
    received,
    prismaArg: () => dbArgument,
  };
}

test("halaman menampilkan judul dan meneruskan daftar keluarga besar ke form", async () => {
  const branches = [branch(), branch({ id: "b-2", name: "Keluarga Basri", branchNumber: 2 })];
  const { Page, received } = loadPage(branches);
  const html = renderToStaticMarkup(await Page());

  assert.ok(
    html.includes("Registrasi Data Keluarga Wirjodihardjo"),
    "judul halaman tampil",
  );
  assert.ok(html.includes("Pendaftaran Reuni"), "bagian pendaftaran reuni ada di judul");

  assert.equal(received.length, 1, "form dirender sekali");
  assert.deepEqual(
    plain(received[0].branches.map((b) => b.name)),
    branches.map((b) => b.name),
    "seluruh daftar keluarga besar diteruskan apa adanya",
  );
  assert.equal(received[0].reuniTitle, REUNI_TITLE, "judul reuni diteruskan dari lib");
});

test("halaman membaca daftar cabang lewat prisma, bukan daftar hardcoded", async () => {
  const { Page, prismaArg } = loadPage([branch()]);
  await Page();
  assert.ok(prismaArg(), "getRegistrationBranches dipanggil dengan instance prisma");
});

test("halaman tetap merender form ketika belum ada keluarga besar", async () => {
  const { Page, received } = loadPage([]);
  const html = renderToStaticMarkup(await Page());

  assert.ok(html.includes("Registrasi Data Keluarga Wirjodihardjo"));
  assert.equal(received.length, 1, "form tetap dirender");
  assert.deepEqual(plain(received[0].branches), [], "form menerima daftar kosong");
});

/* ── Komponen client ─────────────────────────────────────────── */

function loadForm() {
  const nativeRequire = createRequire(FORM_FILE);
  const exports: Record<string, unknown> = {};
  runInNewContext(
    transpile(FORM_FILE),
    {
      exports,
      require: (id: string) => {
        if (id === "@/lib/utils") {
          return { cn: (...values: unknown[]) => values.filter(Boolean).join(" ") };
        }
        if (id === "@/components/ui/EmptyState") {
          return {
            EmptyState: (props: { title: string; description: string }) =>
              React.createElement("div", { role: "note" }, `${props.title} ${props.description}`),
          };
        }
        if (id === "@/lib/registrasi") return {};
        return nativeRequire(id);
      },
    },
    { filename: FORM_FILE },
  );

  return exports as {
    RegistrasiForm: (props: { branches: Branch[]; reuniTitle: string }) => React.ReactElement;
    createLedgerRow: (o?: Partial<LedgerRow>) => LedgerRow;
    createLedgerRows: (n?: number) => LedgerRow[];
    isRowEmpty: (row: LedgerRow) => boolean;
    isRowPartial: (row: LedgerRow) => boolean;
    submittedRows: (rows: LedgerRow[]) => { row: LedgerRow; uiIndex: number }[];
    toPayloadRows: (rows: LedgerRow[]) => LedgerRow[];
    attendeeCount: (rows: LedgerRow[]) => number;
    filterBranches: (branches: Branch[], query: string) => Branch[];
    mapServerErrors: (
      errors: { index: number; field: string; message: string }[] | undefined,
      submitted: { row: LedgerRow; uiIndex: number }[],
    ) => { rowErrors: { rowIndex: number; field: string; message: string }[]; formError: string | null };
    fieldErrorOf: (
      rowErrors: { rowIndex: number; field: string; message: string }[],
      rowIndex: number,
      field: string,
    ) => string | undefined;
    INITIAL_LEDGER_ROWS: number;
    MAX_LEDGER_ROWS: number;
  };
}

type LedgerRow = {
  namaPanggilan: string;
  namaLengkap: string;
  gender: "L" | "P";
  status: "ALIVE" | "DECEASED";
  hadir: boolean;
};

const form = loadForm();

/**
 * Nilai dari modul yang dimuat di `vm` memakai prototype realm sendiri, jadi
 * `deepEqual` yang ketat akan menolak meski isinya sama. Salin lewat JSON
 * supaya perbandingan benar-benar membandingkan isi.
 */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function renderForm(branches: Branch[]): string {
  return renderToStaticMarkup(
    React.createElement(form.RegistrasiForm, { branches, reuniTitle: REUNI_TITLE }),
  );
}

/* ── Helper murni ────────────────────────────────────────────── */

test("batas baris di form sama dengan batas keras di lib registrasi", async () => {
  const lib = await loadRegistrationLib();
  assert.equal(form.MAX_LEDGER_ROWS, lib.MAX_ROWS, "batas baris tidak melenceng dari lib");
  assert.equal(form.INITIAL_LEDGER_ROWS, 5, "buka dengan lima baris");
});

async function loadRegistrationLib() {
  const libFile = resolve("src/lib/registrasi.ts");
  const nativeRequire = createRequire(libFile);
  const exports: Record<string, unknown> = {};
  runInNewContext(
    ts.transpileModule(readFileSync(libFile, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    {
      exports,
      require: (id: string) => {
        if (id === "bcryptjs") return { __esModule: true, default: async () => "hash" };
        if (id === "@/lib/import/username") {
          return {
            deriveUniqueUsername: () => "user",
            deriveBaseUsername: () => "user",
          };
        }
        return nativeRequire(id);
      },
    },
    { filename: libFile },
  );
  return exports as { MAX_ROWS: number; MIN_ROWS: number };
}

test("baris baru tidak memilih gender secara diam-diam", () => {
  const row = form.createLedgerRow();
  assert.deepEqual(plain(row), {
    namaPanggilan: "",
    namaLengkap: "",
    // Kosong, bukan "L": arsip keluarga tidak boleh menebak jenis kelamin
    // orang yang belum memilih.
    gender: "",
    status: "ALIVE",
    hadir: false,
  });
});

test("buka form dengan lima baris yang terpisah satu sama lain", () => {
  const rows = form.createLedgerRows();
  assert.equal(rows.length, 5);
  rows[0].namaPanggilan = "Pak Basri";
  assert.equal(rows[1].namaPanggilan, "", "baris tidak berbagi objek yang sama");
  assert.equal(form.createLedgerRows(2).length, 2, "jumlah baris bisa diatur");
});

test("baris kosong diabaikan, baris terisi sebagian dianggap belum sah", () => {
  assert.equal(form.isRowEmpty(form.createLedgerRow()), true);
  assert.equal(form.isRowEmpty(form.createLedgerRow({ namaPanggilan: "   " })), true);

  const onlyNickname = form.createLedgerRow({ namaPanggilan: "Pak Basri" });
  assert.equal(form.isRowEmpty(onlyNickname), false);
  assert.equal(form.isRowPartial(onlyNickname), true);

  const onlyFullName = form.createLedgerRow({ namaLengkap: "Basri Santoso" });
  assert.equal(form.isRowPartial(onlyFullName), true);

  const lengkap = form.createLedgerRow({ namaPanggilan: "Pak Basri", namaLengkap: "Basri Santoso" });
  assert.equal(form.isRowPartial(lengkap), false);
});

test("isi kosong tidak ikut dikirim, indeks baris aslinya tetap tercatat", () => {
  const rows = [
    form.createLedgerRow(),
    form.createLedgerRow({ namaPanggilan: "Pak Basri", namaLengkap: "Basri Santoso" }),
    form.createLedgerRow({ namaPanggilan: "   " }),
    form.createLedgerRow({ namaPanggilan: "Bu Tini", namaLengkap: "Tinia Wulandari" }),
  ];
  assert.deepEqual(
    plain(form.submittedRows(rows).map((s) => s.uiIndex)),
    [1, 3],
  );
});

test("payload membuang baris kosong dan memangkas spasi nama sebelum dikirim", () => {
  const rows = [
    form.createLedgerRow(),
    form.createLedgerRow({
      namaPanggilan: "  Pak Basri  ",
      namaLengkap: "Basri Santoso",
      gender: "L",
      hadir: true,
    }),
    form.createLedgerRow({ namaPanggilan: "Bu Tini", namaLengkap: "Tinia Wulandari", gender: "P" }),
  ];
  const payload = form.toPayloadRows(rows);

  assert.equal(payload.length, 2, "dua baris terisi, baris kosong dibuang");
  assert.deepEqual(plain(payload[0]), {
    namaPanggilan: "Pak Basri",
    namaLengkap: "Basri Santoso",
    gender: "L",
    status: "ALIVE",
    hadir: true,
  });
  assert.equal(payload[1].gender, "P");
});

test("peserta reuni adalah yang hadir dan masih hidup", () => {
  const rows = [
    form.createLedgerRow({ namaPanggilan: "A", namaLengkap: "A", hadir: true }),
    form.createLedgerRow({
      namaPanggilan: "B",
      namaLengkap: "B",
      hadir: true,
      status: "DECEASED",
    }),
    form.createLedgerRow({ namaPanggilan: "C", namaLengkap: "C", hadir: false }),
    form.createLedgerRow(),
  ];
  assert.equal(form.attendeeCount(rows), 1);
});

test("pencarian keluarga besar menyaring berdasarkan nama, kosong berarti semua", () => {
  const branches = [
    branch({ id: "b-1", name: "Keluarga Besar Wirjodihardjo 1" }),
    branch({ id: "b-2", name: "Keluarga Basri", branchNumber: 2 }),
  ];
  assert.equal(form.filterBranches(branches, "").length, 2);
  assert.equal(form.filterBranches(branches, "  ").length, 2);
  assert.deepEqual(
    plain(form.filterBranches(branches, "basri").map((b) => b.id)),
    ["b-2"],
  );
  assert.deepEqual(plain(form.filterBranches(branches, "tidak ada yang begini")), []);
});

test("error server dipetakan ke baris dan field yang benar di form", () => {
  const rows = [
    form.createLedgerRow(),
    form.createLedgerRow(),
    form.createLedgerRow({ namaPanggilan: "Pak Basri", namaLengkap: "Basri Santoso" }),
    form.createLedgerRow({ namaPanggilan: "Bu Tini", namaLengkap: "Tinia Wulandari" }),
  ];
  const submitted = form.submittedRows(rows);

  // Server mengindeks baris yang terkirim, bukan baris di layar: baris 03 dan 04.
  const mapped = form.mapServerErrors(
    [
      { index: 1, field: "namaLengkap", message: "Nama lengkap wajib diisi." },
      { index: 0, field: "gender", message: "Pilih L atau P." },
    ],
    submitted,
  );

  assert.deepEqual(plain(mapped.rowErrors), [
    { rowIndex: 3, field: "namaLengkap", message: "Nama lengkap wajib diisi." },
    { rowIndex: 2, field: "gender", message: "Pilih L atau P." },
  ]);
  assert.equal(mapped.formError, null);
  assert.equal(form.fieldErrorOf(mapped.rowErrors, 3, "namaLengkap"), "Nama lengkap wajib diisi.");
  assert.equal(form.fieldErrorOf(mapped.rowErrors, 3, "namaPanggilan"), undefined);
});

test("error tingkat form dari server tidak dipaksa ke baris tertentu", () => {
  const mapped = form.mapServerErrors(
    [{ index: 0, field: "rows", message: "Isi minimal satu baris anggota." }],
    form.submittedRows([form.createLedgerRow()]),
  );
  assert.deepEqual(plain(mapped.rowErrors), []);
  assert.equal(mapped.formError, "Isi minimal satu baris anggota.");
});

test("balasan error tanpa bentuk tetap ditangani tanpa melempar", () => {
  const mapped = form.mapServerErrors(undefined, []);
  assert.deepEqual(plain(mapped.rowErrors), []);
  assert.equal(mapped.formError, null);
});

test("indeks error yang menunjuk baris tak terkirim diabaikan", () => {
  const mapped = form.mapServerErrors(
    [{ index: 7, field: "namaPanggilan", message: "Nama panggilan wajib diisi." }],
    form.submittedRows([form.createLedgerRow({ namaPanggilan: "A", namaLengkap: "A" })]),
  );
  assert.deepEqual(plain(mapped.rowErrors), []);
});

/* ── Render komponen ─────────────────────────────────────────── */

test("form menampilkan lima baris awal dengan nomor urut di gutter", () => {
  const html = renderForm([branch()]);
  for (const number of ["01", "02", "03", "04", "05"]) {
    assert.ok(html.includes(`>${number}</span>`), `gutter baris ${number} tampil`);
  }
  assert.ok(html.includes("5 dari 50 baris"), "jumlah baris dan batas keras disebut");
  assert.ok(html.includes("Kirim ke buku besar"), "tombol kirim memakai kalimat yang spesifik");
  assert.ok(html.includes("Tambah baris"), "ada cara menambah baris");
  assert.ok(html.includes('type="submit"'), "tombol kirim adalah submit");
  assert.ok(html.includes('type="checkbox"'), "kehadiran memakai checkbox asli");
});

test("kolom keluarga besar adalah combobox yang bisa difilter dan diketik", () => {
  const html = renderForm([branch(), branch({ id: "b-2", name: "Keluarga Basri", branchNumber: 2 })]);
  assert.ok(html.includes('role="combobox"'), "input berperan combobox");
  assert.ok(html.includes('role="listbox"'), "daftarnya berperan listbox");
  assert.ok(html.includes('role="option"'), "butir daftar berperan option");
  assert.ok(html.includes('aria-expanded="false"'), "daftar tertutup pada keadaan awal");
  assert.ok(html.includes('aria-autocomplete="list"'), "pencarian otomatis diumumkan");
  assert.ok(html.includes('aria-controls="keluarga-besar-daftar"'), "listbox terhubung ke input");
  assert.ok(html.includes('for="keluarga-besar"'), "input punya label nyata");
  assert.ok(html.includes("Keluarga Basri"), "nama cabang diteruskan ke daftar");
  assert.ok(html.includes("panah atas dan bawah"), "keterangan combobox menjelaskan tombol keyboard");
});

test("setiap isian punya label nyata, bukan hanya placeholder", () => {
  const html = renderForm([branch()]);
  for (const id of [
    "baris-1-namaPanggilan",
    "baris-1-namaLengkap",
    "baris-1-gender",
    "baris-1-status",
    "baris-1-hadir",
  ]) {
    assert.ok(html.includes(`for="${id}"`), `label untuk ${id} ada`);
    assert.ok(html.includes(`id="${id}"`), `isian ${id} ada`);
  }
  assert.ok(html.includes("Hapus baris 1"), "baris punya tombol hapus yang bernama");
});

test("kondisi kosong saat belum ada keluarga besar, tanpa form yang tak bisa dikirim", () => {
  const html = renderForm([]);
  assert.ok(html.includes("Belum ada keluarga besar yang bisa dipilih"), "judul keadaan kosong tampil");
  assert.ok(html.includes("pengurus"), "keadaan kosong menyebut tindakan berikutnya");
  assert.ok(!html.includes('role="combobox"'), "combobox tidak dibuat tanpa data");
  assert.ok(!html.includes('type="submit"'), "tombol kirim tidak dibuat tanpa data");
});

test("bantuan administrator menjelaskan aturan baris kosong dan baris sebagian", () => {
  const html = renderForm([branch()]);
  assert.ok(html.includes("Baris yang dibiarkan kosong diabaikan"));
  assert.ok(html.includes("Baris yang terisi sebagian akan ditandai"));
  assert.ok(html.includes(REUNI_TITLE), "judul reuni nyata ikut tampil, bukan karangan");
});
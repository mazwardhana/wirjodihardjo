import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

/* Daftar anggota adalah komponen server murni: tanpa state, tanpa efek.
   Test memuatnya lewat transpile + vm (pola halaman registrasi) supaya tidak
   butuh lingkungan Next, lalu memeriksa HTML yang benar-benar dirender. */

const COMPONENT_FILE = resolve("src/components/registrasi/MemberRegistry.tsx");

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

type Row = {
  id: string;
  fullName: string;
  namaPanggilan: string | null;
  gender: "MALE" | "FEMALE" | "OTHER";
  branchName: string | null;
  branchNumber: number | null;
  fromRegistration: boolean;
};

function row(overrides: Partial<Row> = {}): Row {
  return {
    id: "p1",
    fullName: "Budi Santoso",
    namaPanggilan: "Budi",
    gender: "MALE",
    branchName: "Keluarga Soedjinah",
    branchNumber: 1,
    fromRegistration: false,
    ...overrides,
  };
}

const BRANCHES = [
  { id: "b1", name: "Keluarga Soedjinah", branchNumber: 1 },
  { id: "b2", name: "Keluarga Suwito", branchNumber: 2 },
];

function loadComponent() {
  const nativeRequire = createRequire(COMPONENT_FILE);
  const exports: Record<string, unknown> = {};
  runInNewContext(
    transpile(COMPONENT_FILE),
    {
      exports,
      // `URLSearchParams` dipakai `href()` untuk membangun tautan paginasi.
      // Konten vm tidak punya globals Node secara bawaan, jadi disuntikkan di sini.
      URLSearchParams,
      require: (id: string) => {
        // `next/link` diganti elemen <a> biasa: yang diuji adalah HTML hasil
        // render, bukan perilaku client-side navigasi Next.
        if (id === "next/link") {
          return {
            __esModule: true,
            default: (props: { href: string; children?: React.ReactNode; rel?: string }) =>
              React.createElement("a", { href: props.href, rel: props.rel }, props.children),
          };
        }
        if (id === "@/components/ui/EmptyState") {
          return {
            EmptyState: (props: { title: string; description: string; action?: React.ReactNode }) =>
              React.createElement(
                "div",
                { role: "note" },
                `${props.title} ${props.description}`,
                props.action,
              ),
          };
        }
        return nativeRequire(id);
      },
    },
    { filename: COMPONENT_FILE },
  );
  return exports as {
    MemberRegistry: (props: {
      result: {
        rows: Row[];
        total: number;
        page: number;
        pageSize: number;
        branches: { id: string; name: string; branchNumber: number }[];
      };
      branches: { id: string; name: string; branchNumber: number }[];
      branchId: string;
      q: string;
      basePath: string;
      headingLevel?: "h1" | "h2";
    }) => React.ReactElement;
  };
}

const component = loadComponent();

function render(
  rows: Row[],
  options: {
    total?: number;
    page?: number;
    pageSize?: number;
    branchId?: string;
    q?: string;
    headingLevel?: "h1" | "h2";
  } = {},
): string {
  const pageSize = options.pageSize ?? 20;
  return renderToStaticMarkup(
    React.createElement(component.MemberRegistry, {
      result: {
        rows,
        total: options.total ?? rows.length,
        page: options.page ?? 1,
        pageSize,
        branches: BRANCHES,
      },
      branches: BRANCHES,
      branchId: options.branchId ?? "",
      q: options.q ?? "",
      basePath: "/registrasi",
      ...(options.headingLevel ? { headingLevel: options.headingLevel } : {}),
    }),
  );
}

test("kepala tabel memuat empat kolom yang diminta", () => {
  const html = render([row()]);
  for (const header of [
    "Anggota keluarga cabang",
    "Nama panggilan",
    "Nama lengkap",
    "Jenis kelamin",
  ]) {
    assert.ok(html.includes(header), `kolom "${header}" tampil`);
  }
  assert.ok(html.includes('scope="col"'), "kepala kolom memakai scope");
  assert.ok(html.includes('scope="row"'), "nama anggota memakai scope row");
});

test("baris memuat nama panggilan, nama lengkap, dan cabangnya", () => {
  const html = render([
    row({ id: "a", fullName: "Budi Santoso", namaPanggilan: "Budi", branchName: "Keluarga Soedjinah" }),
    row({ id: "b", fullName: "Siti Rahayu", namaPanggilan: "Siti", branchName: "Keluarga Suwito" }),
  ]);
  assert.ok(html.includes("Budi Santoso") && html.includes("Budi"));
  assert.ok(html.includes("Siti Rahayu") && html.includes("Siti"));
  assert.ok(html.includes("Keluarga Soedjinah"));
  assert.ok(html.includes("Keluarga Suwito"));
});

test("jenis kelamin tampil sebagai L/P dengan judul label panjang", () => {
  const html = render([
    row({ id: "m", gender: "MALE" }),
    row({ id: "f", gender: "FEMALE" }),
    row({ id: "o", gender: "OTHER" }),
  ]);
  assert.ok(html.includes('title="Laki-laki"') && html.includes(">L<"));
  assert.ok(html.includes('title="Perempuan"') && html.includes(">P<"));
  assert.ok(html.includes('title="Lainnya"'), "gender lain diberi judul");
});

test("baris dari registrasi diberi lencana, baris lain tidak", () => {
  const withBatch = render([row({ id: "a", fromRegistration: true })]);
  const without = render([row({ id: "b", fromRegistration: false })]);
  assert.ok(withBatch.includes("Via form registrasi"), "lencana asal tampil");
  assert.ok(!without.includes("Via form registrasi"), "tanpa batch, tanpa lencana");
});

test("anggota tanpa cabang ditulis sebagai belum ditugaskan", () => {
  const html = render([row({ branchName: null })]);
  assert.ok(html.includes("Belum ditugaskan"));
});

test("nama panggilan kosong ditulis sebagai strip, bukan sel kosong", () => {
  const html = render([row({ namaPanggilan: null })]);
  assert.ok(html.includes("—"), "sel nama panggilan kosong diberi strip");
});

test("ringkasan menampilkan rentang baris dan total", () => {
  const html = render([row()], { total: 42, page: 2, pageSize: 20 });
  assert.ok(html.includes("21"), "baris awal dihitung dari halaman");
  assert.ok(html.includes("40"), "baris akhir dihitung dari halaman");
  assert.ok(html.includes("42"), "total anggota tampil");
  assert.ok(html.includes("Halaman 2 dari"), "posisi halaman tampil");
});

test("tanpa hasil, tampilkan keadaan kosong yang menjelaskan", () => {
  const html = render([]);
  assert.ok(html.includes("Belum ada anggota yang cocok"));
  assert.ok(html.includes("buku besar keluarga masih kosong") || html.includes("masih kosong"));
});

test("keadaan kosong karena saringan menawarkan cara reset", () => {
  const html = render([], { branchId: "b1", q: "tidak ada" });
  assert.ok(html.includes("saringan ini"), "menyebut saringan sebagai penyebab");
  assert.ok(html.includes("Lihat seluruh anggota"), "ada tautan reset");
  assert.ok(html.includes("/registrasi"), "tautan reset menuju basePath");
});

test("form filter memuat pilihan cabang dan kotak cari", () => {
  const html = render([row()], { branchId: "b1", q: "Budi" });
  assert.ok(html.includes('method="get"'), "filter memakai GET");
  assert.ok(html.includes('action="/registrasi"'), "aksi menuju basePath");
  assert.ok(html.includes('id="daftar-cabang"'), "select cabang ada");
  assert.ok(html.includes('id="daftar-cari"'), "input cari ada");
  assert.ok(html.includes('value="b1"'), "cabang terpilih dipertahankan");
  assert.ok(html.includes('value="Budi"'), "kata kunci dipertahankan");
  assert.ok(html.includes("Semua keluarga cabang"), "ada pilihan semua cabang");
  assert.ok(html.includes("Keluarga Suwito"), "seluruh cabang tersedia di filter");
});

test("tombol reset hanya muncul bila ada saringan aktif", () => {
  const withFilter = render([row()], { branchId: "b1" });
  const without = render([row()]);
  assert.ok(withFilter.includes(">Reset<"), "reset tampil saat ada filter");
  assert.ok(!without.includes(">Reset<"), "reset tidak tampil tanpa filter");
});

test("paginasi hanya tampil bila ada lebih dari satu halaman", () => {
  const satu = render([row()], { total: 20, page: 1, pageSize: 20 });
  assert.ok(!satu.includes("Sebelumnya"), "tanpa halaman kedua, tanpa navigasi");

  const banyak = render([row()], { total: 45, page: 2, pageSize: 20 });
  assert.ok(banyak.includes("Sebelumnya") && banyak.includes("Berikutnya"));
  assert.ok(banyak.includes('rel="prev"') && banyak.includes('rel="next"'));
  assert.ok(banyak.includes('aria-label="Halaman daftar anggota"'), "nav diberi nama");
});

test("tautan paginasi mempertahankan filter cabang dan pencarian", () => {
  const html = render([row()], { total: 45, page: 1, pageSize: 20, branchId: "b1", q: "Budi" });
  assert.ok(html.includes("branchId=b1"), "filter cabang ikut di URL halaman berikut");
  assert.ok(html.includes("q=Budi"), "kata kunci ikut di URL halaman berikut");
  assert.ok(html.includes("page=2"), "nomor halaman ikut di URL");
});

test("halaman pertama tidak menautkan dirinya sendiri", () => {
  const html = render([row()], { total: 45, page: 1, pageSize: 20 });
  // Tombol Sebelumnya nonaktif (span, bukan tautan) di halaman pertama.
  assert.ok(html.includes('aria-disabled="true"'), "navigasi yang tak tersedia dinonaktifkan");
  assert.ok(!html.includes('rel="prev"'), "tidak ada tautan ke halaman sebelumnya di halaman 1");
});

test("tingkat judul mengikuti headingLevel, bawaannya h2", () => {
  const bawaan = render([row()]);
  assert.ok(
    bawaan.includes('<h2 id="judul-daftar-anggota"'),
    "tanpa prop, bagian ini subsection sehingga judulnya h2",
  );

  const h1 = render([row()], { headingLevel: "h1" });
  assert.ok(
    h1.includes('<h1 id="judul-daftar-anggota"'),
    "di halaman daftar penuh, bagian ini halaman itu sendiri sehingga judulnya h1",
  );
  assert.ok(!h1.includes('<h2 id="judul-daftar-anggota"'), "h2 lama tidak ikut dirender");
});

test("aria-labelledby tetap menunjuk id judul yang sama di kedua tingkat", () => {
  for (const headingLevel of [undefined, "h1" as const]) {
    const html = render([row()], { headingLevel });
    assert.ok(html.includes('aria-labelledby="judul-daftar-anggota"'), "seksi ditautkan ke judulnya");
    assert.ok(html.includes('id="judul-daftar-anggota"'), "judulnya punya id untuk ditautkan");
  }
});

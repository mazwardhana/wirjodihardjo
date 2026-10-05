import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

/* Impor registrasi: halaman server hanya menegakkan gerbang SUPER_ADMIN lalu
   meneruskan 10 batch terakhir ke komponen client. Test ini memuat kedua
   berkas lewat transpile + vm (pola yang sama dengan test registrasi publik)
   supaya tidak butuh lingkungan Next. */

const PAGE_FILE = resolve("src/app/admin/registrasi/page.tsx");
const CLIENT_FILE = resolve("src/app/admin/registrasi/RegistrasiImporClient.tsx");

const pageRequire = createRequire(PAGE_FILE);
const clientRequire = createRequire(CLIENT_FILE);

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

/**
 * Nilai dari modul yang dimuat di `vm` memakai prototype realm sendiri, jadi
 * `deepEqual` yang ketat akan menolak meski isinya sama. Salin lewat JSON
 * supaya perbandingan benar-benar membandingkan isi.
 */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

type BatchRow = {
  id: string;
  filename: string;
  status: string;
  totalRows: number;
  successRows: number;
  errorRows: number;
  createdAt: Date;
  createdBy: { person: { fullName: string } };
};

type BatchSummary = {
  id: string;
  filename: string;
  status: string;
  totalRows: number;
  successRows: number;
  errorRows: number;
  createdAt: string;
  createdBy: string;
};

function batchRow(overrides: Partial<BatchRow> = {}): BatchRow {
  return {
    id: "batch-1",
    filename: "registrasi-oktober.xlsx",
    status: "VALIDATED",
    totalRows: 12,
    successRows: 10,
    errorRows: 2,
    createdAt: new Date("2026-10-01T08:00:00.000Z"),
    createdBy: { person: { fullName: "Siti Admin" } },
    ...overrides,
  };
}

/* ── Halaman server ──────────────────────────────────────────── */

function loadPage(
  options: {
    sessionUser?: { id: string } | null;
    role?: string | null;
    rows?: BatchRow[];
  } = {},
) {
  const rows = options.rows ?? [batchRow()];
  const findManyCalls: unknown[] = [];
  const prisma = {
    user: {
      findUnique: async () =>
        options.role === undefined
          ? { role: "SUPER_ADMIN" }
          : options.role === null
          ? null
          : { role: options.role },
    },
    importBatch: {
      findMany: async (args: unknown) => {
        findManyCalls.push(args);
        return rows;
      },
    },
  };
  const received: BatchSummary[][] = [];
  const redirects: string[] = [];

  const exports: Record<string, unknown> = {};
  runInNewContext(
    transpile(PAGE_FILE),
    {
      exports,
      require: (id: string) => {
        if (id === "@/lib/auth") {
          return {
            auth: async () =>
              options.sessionUser === null ? null : { user: options.sessionUser ?? { id: "user-1" } },
          };
        }
        if (id === "@/lib/prisma") return { prisma };
        if (id === "next/navigation") {
          return {
            redirect: (href: string) => {
              redirects.push(href);
              throw new Error("NEXT_REDIRECT");
            },
          };
        }
        if (id === "@/lib/registrasi-import/types") return { REGISTRASI_IMPORT_TYPE: "REGISTRASI" };
        if (id === "./RegistrasiImporClient") {
          return {
            RegistrasiImporClient: (props: { recentBatches: BatchSummary[] }) => {
              received.push(props.recentBatches);
              return React.createElement("div", { "data-client": "registrasi-impor" }, "KOMPONEN_CLIENT");
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
    redirects,
    findManyCalls,
  };
}

test("SUPER_ADMIN melihat judul halaman dan batch terakhir diteruskan ke client", async () => {
  const { Page, received } = loadPage();
  const html = renderToStaticMarkup(await Page());

  assert.ok(html.includes("Impor Data Registrasi Keluarga"), "judul halaman tampil");
  assert.ok(html.includes('data-client="registrasi-impor"'), "komponen client ikut dirender");
  assert.equal(received.length, 1, "client dirender sekali");
  assert.deepEqual(
    plain(received[0]),
    [
      {
        id: "batch-1",
        filename: "registrasi-oktober.xlsx",
        status: "VALIDATED",
        totalRows: 12,
        successRows: 10,
        errorRows: 2,
        createdAt: "2026-10-01T08:00:00.000Z",
        createdBy: "Siti Admin",
      },
    ],
    "batch dipetakan ke bentuk ringkas milik API",
  );
});

test("halaman membaca 10 batch registrasi terakhir lewat prisma", async () => {
  const { Page, findManyCalls } = loadPage({ rows: [] });
  await Page();
  assert.equal(findManyCalls.length, 1, "findMany dipanggil sekali");
  const args = plain(findManyCalls[0]) as { where: { type: string }; take: number; orderBy: { createdAt: string } };
  assert.equal(args.where.type, "REGISTRASI", "hanya batch bertipe registrasi");
  assert.equal(args.take, 10, "membatasi 10 batch terakhir");
  assert.equal(args.orderBy.createdAt, "desc", "terbaru di urutan atas");
});

test("pengguna tanpa sesi diarahkan ke /login", async () => {
  const { Page, redirects } = loadPage({ sessionUser: null });
  await assert.rejects(async () => {
    await Page();
  }, /NEXT_REDIRECT/);
  assert.deepEqual(plain(redirects), ["/login"], "redirect ke /login");
});

test("admin yang bukan SUPER_ADMIN diarahkan ke /dashboard", async () => {
  const { Page, redirects } = loadPage({ role: "BRANCH_ADMIN" });
  await assert.rejects(async () => {
    await Page();
  }, /NEXT_REDIRECT/);
  assert.deepEqual(plain(redirects), ["/dashboard"], "redirect ke /dashboard");
});

test("petunjuk menyebut kolom template, password default, dan baris yang dilewati", async () => {
  const { Page } = loadPage();
  const html = renderToStaticMarkup(await Page());

  for (const column of [
    "kode cabang keluarga",
    "nama panggilan",
    "nama lengkap",
    "gender",
    "status",
    "hadir reuni",
  ]) {
    assert.ok(html.includes(column), `petunjuk menyebut kolom ${column}`);
  }
  assert.ok(html.includes("12345678"), "password default disebut");
  assert.ok(html.includes("login pertama"), "kewajiban ganti password saat login pertama disebut");
  assert.ok(html.includes("dilewati"), "baris yang sudah ada dilaporkan sebagai dilewati");
  assert.ok(
    html.includes('href="/api/admin/registrasi/template?format=xlsx"'),
    "tautan template XLSX ada",
  );
  assert.ok(
    html.includes('href="/api/admin/registrasi/template?format=csv"'),
    "tautan template CSV ada",
  );
});

/* ── Komponen client ─────────────────────────────────────────── */

function loadClient() {
  const exports: Record<string, unknown> = {};
  runInNewContext(
    transpile(CLIENT_FILE),
    {
      exports,
      require: (id: string) => {
        if (id === "next/navigation") {
          return { useRouter: () => ({ refresh: () => {}, push: () => {} }) };
        }
        if (id === "next/link") {
          return {
            __esModule: true,
            default: (props: { href: string; children?: React.ReactNode }) =>
              React.createElement("a", { href: props.href }, props.children),
          };
        }
        if (id === "@/lib/utils") {
          return {
            formatDate: (value: Date | string | null | undefined) => (value ? String(value) : "-"),
          };
        }
        if (id === "@/lib/import/types") return { MAX_IMPORT_BYTES: 10 * 1024 * 1024 };
        return clientRequire(id);
      },
    },
    { filename: CLIENT_FILE },
  );

  return exports as {
    RegistrasiImporClient: (props: { recentBatches: BatchSummary[] }) => React.ReactElement;
  };
}

const client = loadClient();

function renderClient(batches: BatchSummary[]): string {
  return renderToStaticMarkup(
    React.createElement(client.RegistrasiImporClient, { recentBatches: batches }),
  );
}

function clientBatch(overrides: Partial<BatchSummary> = {}): BatchSummary {
  return {
    id: "batch-1",
    filename: "registrasi-oktober.xlsx",
    status: "COMMITTED",
    totalRows: 12,
    successRows: 10,
    errorRows: 2,
    createdAt: "2026-10-01T08:00:00.000Z",
    createdBy: "Siti Admin",
    ...overrides,
  };
}

test("form unggah memuat input file, tombol unggah, dan tautan template", () => {
  const html = renderClient([]);

  assert.ok(html.includes('type="file"'), "input file ada");
  assert.ok(html.includes('accept=".xlsx,.xlsm,.csv"'), "input menerima xlsx/xlsm/csv");
  assert.ok(/Unggah (&amp;|&) Validasi/.test(html), "tombol Unggah & Validasi ada");
  assert.ok(
    html.includes('href="/api/admin/registrasi/template?format=xlsx"'),
    "tautan template XLSX ada di client",
  );
  assert.ok(
    html.includes('href="/api/admin/registrasi/template?format=csv"'),
    "tautan template CSV ada di client",
  );
});

test("tombol konfirmasi tidak aktif sebelum ada hasil valid yang lolos", () => {
  const html = renderClient([]);
  const button = html.match(/<button[^>]*>([^<]*Konfirmasi[^<]*)<\/button>/);
  assert.ok(button, "tombol Konfirmasi & Simpan ada");
  assert.ok(button[0].includes("disabled"), "tombol nonaktif sebelum ada hasil valid");
});

test("riwayat kosong menampilkan keadaan kosong", () => {
  const html = renderClient([]);
  assert.ok(html.includes("Belum ada impor registrasi"), "keadaan kosong tampil");
});

test("riwayat menampilkan batch tersimpan dengan tautan kredensial", () => {
  const html = renderClient([clientBatch()]);

  assert.ok(html.includes("registrasi-oktober.xlsx"), "nama berkas tampil");
  assert.ok(html.includes("Siti Admin"), "pembuat batch tampil");
  assert.ok(html.includes("Tersimpan"), "status batch dipetakan ke bahasa Indonesia");
  assert.ok(html.includes("2026-10-01T08:00:00.000Z"), "tanggal batch tampil");
  assert.ok(
    html.includes('href="/api/admin/registrasi/laporan?id=batch-1&amp;format=credentials"'),
    "tautan unduh kredensial memakai batch yang benar",
  );
});

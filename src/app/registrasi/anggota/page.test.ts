import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

/* Halaman daftar anggota adalah server component yang membaca query string
   untuk filter dan paginasi. Test memuatnya lewat transpile + vm (pola yang
   sama dengan test halaman registrasi) supaya tidak butuh lingkungan Next, lalu
   memeriksa apa yang diteruskan ke MemberRegistry. */

const PAGE_FILE = resolve("src/app/registrasi/anggota/page.tsx");

const pageRequire = createRequire(PAGE_FILE);

type Branch = { id: string; name: string; branchNumber: number };

const BRANCHES: Branch[] = [
  { id: "b-1", name: "Keluarga Besar Wirjodihardjo 1", branchNumber: 1 },
  { id: "b-2", name: "Keluarga Basri", branchNumber: 2 },
];

type Query = {
  branchId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};

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

function loadPage() {
  const prisma = { person: { count: async () => 0 } };
  const queries: Query[] = [];
  const registryReceived: {
    branchId: string;
    q: string;
    basePath: string;
    headingLevel?: string;
    rows: unknown[];
  }[] = [];
  let dbArgument: unknown = null;

  const exports: Record<string, unknown> = {};
  runInNewContext(
    transpile(PAGE_FILE),
    {
      exports,
      require: (id: string) => {
        if (id === "@/lib/prisma") return { prisma };
        if (id === "@/lib/registrasi-registry") {
          return {
            REGISTRY_PAGE_SIZE: 20,
            asRegistryDb: (client: unknown) => {
              dbArgument = client;
              return client;
            },
            getPublicMembers: async (_db: unknown, query: Query) => {
              queries.push(query);
              return {
                rows: [],
                total: 0,
                page: query.page ?? 1,
                pageSize: 20,
                branches: BRANCHES,
              };
            },
          };
        }
        if (id === "@/components/registrasi/MemberRegistry") {
          return {
            MemberRegistry: (props: {
              result: { rows: unknown[]; branches: Branch[] };
              branches: Branch[];
              branchId: string;
              q: string;
              basePath: string;
              headingLevel?: string;
            }) => {
              registryReceived.push({
                branchId: props.branchId,
                q: props.q,
                basePath: props.basePath,
                headingLevel: props.headingLevel,
                rows: props.result.rows,
              });
              return React.createElement("div", { "data-registry": "1" }, "daftar anggota");
            },
          };
        }
        if (id === "next/link") {
          return {
            __esModule: true,
            default: (props: { href: string; children?: React.ReactNode }) =>
              React.createElement("a", { href: props.href }, props.children),
          };
        }
        return pageRequire(id);
      },
    },
    { filename: PAGE_FILE },
  );

  return {
    Page: (params: { branchId?: string; q?: string; page?: string } = {}) =>
      (exports.default as (args: {
        searchParams: Promise<unknown>;
      }) => Promise<React.ReactElement>)({
        searchParams: Promise.resolve(params),
      }),
    queries,
    registryReceived,
    prismaArg: () => dbArgument,
  };
}

test("filter cabang dan pencarian diteruskan ke daftar anggota", async () => {
  const { Page, registryReceived } = loadPage();
  // `MemberRegistry` hanya dipanggil saat React me-render pohon, jadi elemen
  // hasil `Page()` harus dirender lebih dulu sebelum `registryReceived` terisi.
  renderToStaticMarkup(await Page({ branchId: " b-1 ", q: "  Budi " }));

  assert.equal(registryReceived[0].branchId, "b-1", "branchId dipangkas sebelum diteruskan");
  assert.equal(registryReceived[0].q, "Budi", "q dipangkas sebelum diteruskan");
});

test("query yang sama diteruskan ke pembaca basis data", async () => {
  const { Page, queries } = loadPage();
  renderToStaticMarkup(await Page({ branchId: "b-2", q: "Siti", page: "3" }));

  assert.equal(queries.length, 1, "daftar dibaca sekali");
  assert.equal(queries[0].branchId, "b-2");
  assert.equal(queries[0].q, "Siti");
  assert.equal(queries[0].page, 3, "nomor halaman diteruskan apa adanya");
  assert.equal(queries[0].pageSize, 20, "ukuran halaman memakai bawaan lib");
});

test("tanpa searchParams, halaman tetap merender daftar tanpa saringan", async () => {
  const { Page, queries, registryReceived } = loadPage();
  const html = renderToStaticMarkup(await Page());

  assert.ok(html.includes('data-registry="1"'), "daftar anggota tetap dirender");
  assert.equal(registryReceived[0].branchId, "", "tanpa filter, branchId kosong");
  assert.equal(registryReceived[0].q, "", "tanpa pencarian, q kosong");
  assert.equal(queries[0].page, 1, "halaman pertama jadi bawaan");
});

test("nomor halaman tidak valid dianggap halaman pertama", async () => {
  const { Page, queries } = loadPage();
  renderToStaticMarkup(await Page({ page: "bukan-angka" }));
  assert.equal(queries[0].page, 1, "URL rusak tidak membuat halaman error");
});

test("filter dan paginasi dibangun relatif ke halaman ini, bukan ke form", async () => {
  const { Page, registryReceived } = loadPage();
  renderToStaticMarkup(await Page({ branchId: "b-1", q: "Budi", page: "2" }));

  assert.equal(
    registryReceived[0].basePath,
    "/registrasi/anggota",
    "form filter harus mengirim balik ke halaman ini, bukan ke /registrasi",
  );
});

test("daftar di halaman ini menjadi h1, bukan h2 di bawah judul form", async () => {
  const { Page, registryReceived } = loadPage();
  renderToStaticMarkup(await Page());

  assert.equal(
    registryReceived[0].headingLevel,
    "h1",
    "halaman tanpa judul lain, jadi bagian ini yang memegang h1",
  );
});

test("daftar dibaca dari instance prisma, bukan dari db hardcoded", async () => {
  const { Page, prismaArg } = loadPage();
  await Page();
  assert.ok(prismaArg(), "asRegistryDb dipanggil dengan instance prisma");
});

test("halaman menyertakan cara kembali ke form registrasi", async () => {
  const { Page } = loadPage();
  const html = renderToStaticMarkup(await Page());

  assert.ok(html.includes('href="/registrasi"'), "ada tautan kembali ke halaman registrasi");
  assert.ok(html.includes("Registrasi Data Keluarga"), "tautan itu bernama, bukan panah telanjang");
});
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const filename = resolve("src/app/galeri/page.tsx");
const nativeRequire = createRequire(filename);

type AlbumRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  eventDate: Date | null;
  coverImageUrl: string | null;
  isPublished: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  _count: { media: number };
  media: Array<{ url: string }>;
};

function loadPage(albums: AlbumRow[]) {
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const exports: Record<string, unknown> = {};
  runInNewContext(
    output,
    {
      exports,
      require: (id: string) => {
        if (id === "@/lib/prisma") return { prisma: { album: { findMany: async () => albums } } };
        if (id === "next/link")
          return {
            __esModule: true,
            default: (props: Record<string, unknown>) =>
              React.createElement(
                "a",
                { href: props.href, className: props.className },
                props.children as React.ReactNode,
              ),
          };
        if (id === "@/components/ui/EmptyState")
          return {
            EmptyState: (props: { title: string; description: string }) =>
              React.createElement("div", null, `${props.title} ${props.description}`),
          };
        return nativeRequire(id.startsWith("@/") ? resolve("src", id.slice(2)) : id);
      },
    },
    { filename },
  );

  return exports.default as () => Promise<React.ReactElement>;
}

function album(overrides: Partial<AlbumRow> = {}): AlbumRow {
  return {
    id: "album-1",
    title: "Reuni Wirjodihardjo 2012",
    slug: "reuni-wirjodihardjo-2012",
    description: "Reuni keluarga di Malang.",
    eventDate: new Date("2012-07-14"),
    coverImageUrl: "/api/media/cover.jpg",
    isPublished: true,
    publishedAt: new Date("2026-10-02"),
    createdAt: new Date("2026-10-01"),
    _count: { media: 9 },
    media: [{ url: "/api/media/cover.jpg" }],
    ...overrides,
  };
}

test("album terbit tampil sebagai sorotan dengan tautan dan jumlah foto", async () => {
  const Page = loadPage([album()]);
  const element = await Page();
  const html = renderToStaticMarkup(element);

  assert.ok(html.includes("Reuni Wirjodihardjo 2012"), "judul album tampil");
  assert.ok(html.includes("/galeri/reuni-wirjodihardjo-2012"), "tautan ke album");
  assert.ok(html.includes("/api/media/cover.jpg"), "sampul album dipakai");
  assert.ok(html.includes("9"), "jumlah foto ditampilkan");
  assert.ok(html.includes("2012"), "tahun acara ditampilkan");
});

test("tanpa album, tampil keadaan kosong", async () => {
  const Page = loadPage([]);
  const element = await Page();
  const html = renderToStaticMarkup(element);
  assert.ok(html.includes("Belum ada album"));
});

test("album tanpa sampul memakai foto pertama sebagai cadangan", async () => {
  const Page = loadPage([
    album({ coverImageUrl: null, media: [{ url: "/api/media/first.jpg" }] }),
  ]);
  const element = await Page();
  const html = renderToStaticMarkup(element);
  assert.ok(html.includes("/api/media/first.jpg"), "foto pertama dipakai bila tanpa sampul");
});

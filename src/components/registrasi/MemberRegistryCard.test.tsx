import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

/* Kartu ini komponen server murni: tanpa state, tanpa efek. Test memuatnya
   lewat transpile + vm (pola MemberRegistry) supaya tidak butuh lingkungan
   Next, lalu memeriksa HTML yang benar-benar dirender. */

const COMPONENT_FILE = resolve("src/components/registrasi/MemberRegistryCard.tsx");

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

function loadComponent() {
  const nativeRequire = createRequire(COMPONENT_FILE);
  const exports: Record<string, unknown> = {};
  runInNewContext(
    transpile(COMPONENT_FILE),
    {
      exports,
      require: (id: string) => {
        // `next/link` diganti <a> biasa: yang diuji adalah HTML hasil render,
        // bukan perilaku navigasi client-side Next. `className` diteruskan
        // supaya affordance tautannya ikut diperiksa.
        if (id === "next/link") {
          return {
            __esModule: true,
            default: (props: { href: string; className?: string; children?: React.ReactNode }) =>
              React.createElement(
                "a",
                { href: props.href, className: props.className },
                props.children,
              ),
          };
        }
        return nativeRequire(id);
      },
    },
    { filename: COMPONENT_FILE },
  );

  return exports as {
    MemberRegistryCard: (props: { count: number }) => React.ReactElement;
  };
}

const component = loadComponent();

function render(count: number): string {
  return renderToStaticMarkup(React.createElement(component.MemberRegistryCard, { count }));
}

test("kartu adalah tautan ke halaman daftar anggota", () => {
  const html = render(42);
  assert.ok(html.includes('href="/registrasi/anggota"'), "kartu menuju halaman daftarnya sendiri");
  assert.ok(html.startsWith("<a "), "akar render adalah anchor, bukan pembungkus lain");
  assert.ok(html.endsWith("</a>"), "tidak ada elemen di luar tautan");
});

test("kartu menyebut judul dan jumlah anggotanya", () => {
  const html = render(42);
  assert.ok(html.includes("Daftar anggota tercatat"), "judul sesuai dengan daftarnya");
  assert.ok(html.includes("42 anggota tercatat"), "jumlah anggota disebut sebagai teks");
});

test("jumlah anggota diformat sebagai angka Indonesia", () => {
  // Pemisah ribuan id-ID memakai titik; angka mentah akan terbaca "1234".
  assert.ok(render(1234).includes("1.234 anggota tercatat"), "ribuan dipisah titik");
  assert.ok(render(0).includes("0 anggota tercatat"), "buku besar yang kosong tetap disebut");
});

test("ikon dan panah disembunyikan dari pembaca layar", () => {
  const html = render(42);
  const hidden = [...html.matchAll(/aria-hidden="true"/g)].length;
  // Buku dan chevron dekoratif; keduanya tak boleh diumumkan, sedangkan nama
  // tautannya tetap terbaca dari teks di dalamnya.
  assert.ok(hidden >= 2, `ikon dekoratif disembunyikan (ditemukan ${hidden})`);
  assert.ok(!html.includes("<img"), "tidak ada gambar tanpa keterangan");
});

test("kartu punya affordance tautan yang bisa difokus", () => {
  const html = render(42);
  assert.ok(html.includes("min-h-11"), "ketinggian sentuh mengikuti situs");
  assert.ok(html.includes("focus-visible:outline-forest"), "cincin fokus memakai warna forest");
  assert.ok(html.includes("hover:border-forest"), "batas kartu berubah saat hover");
});
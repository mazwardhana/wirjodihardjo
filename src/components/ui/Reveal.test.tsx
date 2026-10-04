import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const filename = resolve("src/components/ui/Reveal.tsx");
const require = createRequire(filename);

function renderReveal(props: Record<string, unknown>): string {
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const exports: { Reveal?: (p: Record<string, unknown>) => React.ReactNode } = {};
  runInNewContext(
    output,
    {
      exports,
      // useEffect tidak pernah jalan di render statis; cukup stub agar modul bisa dimuat.
      React: {
        ...React,
        useEffect: () => {},
        useRef: () => ({ current: null }),
        useState: (v: unknown) => [v, () => {}],
      },
      require: (id: string) =>
        id === "react"
          ? {
              ...React,
              useEffect: () => {},
              useRef: () => ({ current: null }),
              useState: (v: unknown) => [v, () => {}],
            }
          : require(id.startsWith("@/") ? resolve("src", id.slice(2)) : id),
    },
    { filename },
  );

  return renderToStaticMarkup(
    React.createElement(exports.Reveal!, props) as React.ReactElement,
  );
}

test("properti aksesibilitas diteruskan ke elemen yang dirender", () => {
  const html = renderReveal({
    as: "section",
    "aria-labelledby": "judul",
    id: "bagian-1",
    children: "Isi",
  });

  // Regresi: atribut ini dulu hilang diam-diam karena Reveal tidak meneruskan sisa properti.
  assert.ok(html.includes('aria-labelledby="judul"'), "aria-labelledby harus sampai ke DOM");
  assert.ok(html.includes('id="bagian-1"'), "id harus sampai ke DOM");
  assert.ok(html.startsWith("<section"), "elemen yang dirender mengikuti properti as");
});

test("atribut data-* ikut diteruskan", () => {
  const html = renderReveal({ "data-testid": "reali", children: "x" });
  assert.ok(html.includes('data-testid="reali"'));
});

test("kelas reveal tetap dipakai dan delay digabung ke style pemanggil", () => {
  const html = renderReveal({
    className: "mt-6",
    delay: 120,
    style: { opacity: 0.5 },
    children: "x",
  });

  assert.ok(html.includes('class="reveal mt-6"'), "kelas reveal tidak hilang");
  assert.ok(html.includes("opacity:0.5"), "style pemanggil dipertahankan");
  assert.ok(html.includes("transition-delay:120ms"), "delay digabung dengan style pemanggil");
});

test("tanpa delay, style pemanggil tidak ditimpa property baru", () => {
  const html = renderReveal({ style: { color: "red" }, children: "x" });
  assert.ok(html.includes("color:red"));
  assert.ok(!html.includes("transition-delay"), "tidak ada transition-delay bila delay kosong");
});
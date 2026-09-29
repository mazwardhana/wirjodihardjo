import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import type { FilterConfig } from "./FilterBar";

const filename = resolve("src/components/admin/FilterBar.tsx");
const require = createRequire(filename);

function render(config: FilterConfig, query = "", pathname = "/admin/pengguna"): string {
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const exports: { FilterBar?: React.ComponentType<{ config: FilterConfig }> } = {};
  const params = new URLSearchParams(query);
  runInNewContext(
    output,
    {
      exports,
      require: (id: string) => {
        if (id === "next/navigation")
          return {
            useRouter: () => ({ replace: () => {} }),
            usePathname: () => pathname,
            useSearchParams: () => params,
          };
        return require(id.startsWith("@/") ? resolve("src", id.slice(2)) : id);
      },
    },
    { filename },
  );

  return renderToStaticMarkup(React.createElement(exports.FilterBar!, { config }));
}

const searchConfig: FilterConfig = { search: { placeholder: "Cari nama", param: "q" } };
const filterOnlyConfig: FilterConfig = {
  filters: [{ param: "status", label: "Status", options: [{ value: "aktif", label: "Aktif" }] }],
};

test("renders the search input inside a form with a Cari submit button", () => {
  const html = render(searchConfig);
  assert.ok(html.includes('role="search"'), "missing search landmark");
  assert.ok(html.includes("<form"), "missing form element");
  assert.ok(html.includes('type="search"'), "missing search input");
  assert.ok(html.includes('aria-label="Cari nama"'), "missing input aria-label");

  const button = html.match(/<button[^>]*type="submit"[^>]*>Cari<\/button>/)?.[0];
  assert.ok(button, "missing Cari submit button");
  for (const token of [
    "min-h-11",
    "bg-forest",
    "text-cream",
    "hover:bg-forest-soft",
    "focus-visible:outline-2",
    "focus-visible:outline-offset-2",
    "focus-visible:outline-forest",
  ]) {
    assert.ok(button.includes(token), `Cari button missing ${token}`);
  }
});

test("shows the URL search value in the input", () => {
  const html = render(searchConfig, "q=budi");
  assert.ok(html.includes('value="budi"'), "input does not reflect the URL query");
});

test("omits the search form when search is not configured", () => {
  const html = render(filterOnlyConfig);
  assert.ok(html.includes("<select"), "missing filter select");
  assert.ok(!html.includes("Cari"), "Cari button rendered without search config");
  assert.ok(!html.includes('type="submit"'), "submit button rendered without search config");
});

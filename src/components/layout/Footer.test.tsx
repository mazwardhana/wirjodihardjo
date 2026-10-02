import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const filename = resolve("src/components/layout/Footer.tsx");
const require = createRequire(filename);

function renderFooter(): string {
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const exports: { Footer?: () => React.ReactNode } = {};
  runInNewContext(
    output,
    {
      exports,
      require: (id: string) => {
        if (id === "next/link") {
          return {
            __esModule: true,
            default: (props: Record<string, unknown>) =>
              React.createElement(
                "a",
                { href: props.href },
                props.children as React.ReactNode,
              ),
          };
        }
        return require(id);
      },
    },
    { filename },
  );

  return renderToStaticMarkup(
    React.createElement(exports.Footer!) as React.ReactElement,
  );
}

test("footer menautkan ke halaman Pengurus", () => {
  const html = renderFooter();
  assert.ok(html.includes('href="/pengurus"'), "footer harus punya tautan /pengurus");
  assert.ok(html.includes("Pengurus"), "label Pengurus harus tampil");
});

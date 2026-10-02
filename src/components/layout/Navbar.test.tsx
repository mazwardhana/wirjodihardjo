import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const filename = resolve("src/components/layout/Navbar.tsx");
const require = createRequire(filename);

function renderNavbar(pathname: string): string {
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const exports: { Navbar?: () => React.ReactNode } = {};
  runInNewContext(
    output,
    {
      exports,
      require: (id: string) => {
        if (id === "next/navigation") return { usePathname: () => pathname };
        if (id === "next/link") {
          return {
            __esModule: true,
            default: (props: Record<string, unknown>) =>
              React.createElement(
                "a",
                {
                  href: props.href,
                  className: props.className,
                  "aria-current": props["aria-current"],
                },
                props.children as React.ReactNode,
              ),
          };
        }
        if (id === "@/lib/auth-client") {
          return { useSession: () => ({ data: null, status: "unauthenticated" }), signOut: () => {} };
        }
        if (id === "@/lib/utils") {
          return { cn: (...parts: unknown[]) => parts.filter(Boolean).join(" ") };
        }
        if (id === "@/components/ui/Avatar") {
          return {
            Avatar: (props: { name?: string }) =>
              React.createElement("span", null, props.name ?? ""),
          };
        }
        return require(id.startsWith("@/") ? resolve("src", id.slice(2)) : id);
      },
    },
    { filename },
  );

  return renderToStaticMarkup(
    React.createElement(exports.Navbar!) as React.ReactElement,
  );
}

test("navbar menampilkan tab Pengurus", () => {
  const html = renderNavbar("/");
  assert.ok(html.includes('href="/pengurus"'), "navbar harus punya tautan /pengurus");
  assert.ok(html.includes("Pengurus"), "label Pengurus harus tampil");
});

test("tab Pengurus aktif saat berada di /pengurus", () => {
  const html = renderNavbar("/pengurus");
  const tag = [...html.matchAll(/<a\b[^>]*>/g)].find((t) =>
    t[0].includes('href="/pengurus"'),
  );
  assert.ok(tag, "tautan Pengurus ada");
  assert.ok(tag![0].includes('aria-current="page"'), "harus ditandai aktif");
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const filename = resolve("src/components/admin/AdminSidebar.tsx");
const require = createRequire(filename);

function render(pathname: string, role: "SUPER_ADMIN" | "BRANCH_ADMIN"): string {
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const exports: { AdminSidebar?: (props: { role: string; fullName: string }) => React.ReactNode } = {};
  runInNewContext(
    output,
    {
      exports,
      require: (id: string) => {
        if (id === "next/navigation") return { usePathname: () => pathname };
        if (id === "next/link")
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
        if (id === "@/lib/auth-client") return { signOut: () => {} };
        return require(id.startsWith("@/") ? resolve("src", id.slice(2)) : id);
      },
    },
    { filename },
  );

  return renderToStaticMarkup(
    React.createElement(exports.AdminSidebar!, { role, fullName: "Test" }) as React.ReactElement,
  );
}

const SUPER_ONLY = ["/admin/cabang", "/admin/impor", "/admin/pengguna", "/admin/audit-log"];
const ALL_VISIBLE = [
  "/admin",
  "/admin/pengajuan",
  "/admin/anggota",
  "/admin/keluarga",
  "/admin/galeri",
  "/admin/hall-of-fame",
  "/admin/artikel",
  "/admin/reuni",
];

test("BRANCH_ADMIN cannot see SUPER-only links; sees the shared links", () => {
  const html = render("/admin", "BRANCH_ADMIN");
  for (const href of SUPER_ONLY) {
    assert.ok(!html.includes(`href="${href}"`), `BRANCH_ADMIN should not see ${href}`);
  }
  for (const href of ALL_VISIBLE) {
    assert.ok(html.includes(`href="${href}"`), `BRANCH_ADMIN should see ${href}`);
  }
});

test("SUPER_ADMIN sees every link, including SUPER-only ones", () => {
  const html = render("/admin", "SUPER_ADMIN");
  for (const href of [...ALL_VISIBLE, ...SUPER_ONLY]) {
    assert.ok(html.includes(`href="${href}"`), `SUPER_ADMIN should see ${href}`);
  }
});

test("no two menu entries share the same icon glyph", () => {
  const html = render("/admin", "SUPER_ADMIN");
  const icons = [...html.matchAll(/<span class="w-5 text-center text-xs">([^<]*)<\/span>/g)].map(
    (m) => m[1],
  );
  // 12 menu entries for super admin; footer "Dashboard"/"Keluar" are not icon spans.
  assert.equal(icons.length, 12, `expected 12 menu icons, got ${icons.length}`);
  const unique = new Set(icons);
  assert.equal(unique.size, icons.length, `duplicate icon glyphs: ${JSON.stringify([...icons])}`);
});

test("active highlight uses prefix match; /admin does not light on sub-routes", () => {
  // Sub-route of anggota highlights the anggota link...
  const anggota = render("/admin/anggota/123", "SUPER_ADMIN");
  const anggotaTag = [...anggota.matchAll(/<a\b[^>]*>/g)].find(
    (t) => t[0].includes('href="/admin/anggota"') && t[0].includes("bg-forest/10"),
  );
  assert.ok(anggotaTag, "/admin/anggota/123 should highlight /admin/anggota");

  // ...but does NOT light up Overview ("/admin").
  const overviewTag = [...anggota.matchAll(/<a\b[^>]*>/g)].find(
    (t) => t[0].includes('href="/admin"') && t[0].includes("bg-forest/10"),
  );
  assert.equal(overviewTag, undefined, "/admin must not be active on /admin/anggota/123");

  // /admin/keluarga lights the keluarga link, not a sibling prefix.
  const keluarga = render("/admin/keluarga", "SUPER_ADMIN");
  const keluargaTag = [...keluarga.matchAll(/<a\b[^>]*>/g)].find(
    (t) => t[0].includes('href="/admin/keluarga"') && t[0].includes("bg-forest/10"),
  );
  assert.ok(keluargaTag, "/admin/keluarga should be active on itself");
});

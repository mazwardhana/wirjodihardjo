import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const filename = resolve("src/components/pwa/MobileBottomNav.tsx");
const require = createRequire(filename);

function render(
  pathname: string,
  status: "authenticated" | "unauthenticated" = "authenticated",
): string {
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const exports: { MobileBottomNav?: () => React.ReactNode } = {};
  runInNewContext(
    output,
    {
      exports,
      require: (id: string) => {
        if (id === "next/navigation") return { usePathname: () => pathname };
        if (id === "@/lib/auth-client") {
          return {
            useSession: () => ({
              data: status === "authenticated" ? { user: { name: "Anggota" } } : null,
              status,
            }),
          };
        }
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
        if (id === "@/lib/utils")
          return { cn: (...classes: unknown[]) => classes.filter(Boolean).join(" ") };
        return require(id.startsWith("@/") ? resolve("src", id.slice(2)) : id);
      },
    },
    { filename },
  );

  return renderToStaticMarkup(exports.MobileBottomNav!() as React.ReactElement);
}

test("renders six member nav items for authenticated users (O1: notifikasi added)", () => {
  const html = render("/dashboard");
  for (const label of ["Beranda", "Silsilah", "Galeri", "Reuni", "Notifikasi", "Profil"]) {
    assert.ok(html.includes(label), `missing label: ${label}`);
  }
  assert.ok(html.includes('class="member-bottom-nav'));
  assert.ok(html.includes('href="/dashboard"'));
  assert.ok(html.includes('href="/silsilah"'));
  assert.ok(html.includes('href="/galeri"'));
  assert.ok(html.includes('href="/reuni"'));
  assert.ok(html.includes('href="/dashboard/notifikasi"'), "O1: notifikasi link missing");
  assert.ok(html.includes('href="/dashboard/profil"'));
  // grid-cols-6 for authenticated
  assert.ok(html.includes("grid-cols-6"), "O1: authenticated nav should use grid-cols-6");
});

test("shows five items for unauthenticated users (no notifikasi, no profil)", () => {
  const html = render("/dashboard", "unauthenticated");
  for (const label of ["Beranda", "Silsilah", "Galeri", "Reuni", "Registrasi"]) {
    assert.ok(html.includes(label), `missing label: ${label}`);
  }
  assert.ok(!html.includes('href="/dashboard/profil"'), "Profil must be hidden when logged out");
  assert.ok(!html.includes(">Profil<"), "Profil label must be hidden when logged out");
  assert.ok(!html.includes('href="/dashboard/notifikasi"'), "Notifikasi must be hidden for guests");
  assert.ok(!html.includes(">Notifikasi<"), "Notifikasi label must be hidden for guests");
  // grid-cols-5 for guest
  assert.ok(html.includes("grid-cols-5"), "O1: guest nav should use grid-cols-5");
});

test("points Beranda to the landing page when not authenticated", () => {
  const html = render("/", "unauthenticated");
  assert.ok(html.includes('href="/"'), "Beranda must link to / when logged out");
  assert.ok(!html.includes('href="/dashboard"'), "dashboard must not be linked when logged out");
});

test("points Beranda to the dashboard when authenticated", () => {
  const html = render("/dashboard", "authenticated");
  assert.ok(html.includes('href="/dashboard"'), "Beranda must link to /dashboard when logged in");
});

test("keeps Profil and drops Registrasi when authenticated", () => {
  const html = render("/dashboard", "authenticated");
  assert.ok(html.includes('href="/dashboard/profil"'));
  assert.ok(html.includes(">Profil<"));
  assert.ok(!html.includes('href="/registrasi"'));
  assert.ok(!html.includes(">Registrasi<"));
});

test("activates the Registrasi item on /registrasi when not authenticated", () => {
  const html = render("/registrasi", "unauthenticated");
  const activeHrefs = [...html.matchAll(/href="([^"]+)"[^>]*aria-current="page"/g)].map(
    (m) => m[1],
  );
  assert.deepEqual(activeHrefs, ["/registrasi"]);
});

test("marks the current route active with aria-current and a gold indicator", () => {
  const silsilah = render("/silsilah");
  assert.ok(silsilah.includes('aria-current="page"'));
  assert.equal((silsilah.match(/aria-current="page"/g) ?? []).length, 1);
  assert.equal((silsilah.match(/bg-gold/g) ?? []).length, 1);

  // /dashboard must not activate when visiting /dashboard/profil.
  const profil = render("/dashboard/profil");
  const activeHrefs = [...profil.matchAll(/href="([^"]+)"[^>]*aria-current="page"/g)].map(
    (m) => m[1],
  );
  assert.deepEqual(activeHrefs, ["/dashboard/profil"]);
});

test("hides on admin, login, onboarding, and sso routes", () => {
  for (const pathname of ["/admin", "/admin/pengguna", "/login", "/onboarding", "/sso/callback"]) {
    const html = render(pathname);
    assert.match(
      html,
      /<nav\b[^>]*\bhidden=""/,
      `expected hidden on ${pathname}`,
    );
  }

  for (const pathname of ["/dashboard", "/silsilah", "/galeri", "/reuni", "/"]) {
    const html = render(pathname);
    assert.doesNotMatch(
      html,
      /<nav\b[^>]*\bhidden=""/,
      `expected visible on ${pathname}`,
    );
  }
});

test("notifikasi link points to /dashboard/notifikasi (O1)", () => {
  const html = render("/dashboard", "authenticated");
  assert.ok(html.includes('href="/dashboard/notifikasi"'), "notifikasi must link to /dashboard/notifikasi");
});

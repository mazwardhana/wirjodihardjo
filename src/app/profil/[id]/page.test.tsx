import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";

const filename = resolve("src/app/profil/[id]/page.tsx");
const require = createRequire(filename);

async function renderPage(role?: string, visible = true) {
  const privateQueries: Array<{ select: Record<string, boolean> }> = [];
  const person = {
    id: "p1", fullName: "Test profile", nickname: null, gender: "MALE", birthDate: null, birthPlace: null, deathDate: null, deathPlace: null, occupation: null, status: null, bio: null, photoUrl: null, generationLevel: null, isDeceased: false, branch: null, socialLinks: [],
    education: [{ id: "edu-1", institution: "Universitas Gadjah Mada", degree: "S1", fieldOfStudy: "Kedokteran", startYear: 1980, endYear: 1986 }],
    lifeEvents: [
      { id: "le-1", kind: "CUSTOM", title: "Catatan pribadi", description: "Rincian privat", locationName: null, latitude: null, longitude: null, date: null, datePrecision: null },
      { id: "le-2", kind: "CUSTOM", title: "Haji", description: null, locationName: "Makkah", latitude: 21.4225, longitude: 39.8262, date: null, datePrecision: null },
    ],
  };
  let cardProps: Record<string, unknown> | null = null;
  const prisma = {
    user: { findUnique: async () => ({ personId: "viewer", role }) },
    person: { findFirst: async () => person },
    personPrivate: { findUnique: async (args: { select: Record<string, boolean> }) => {
      privateQueries.push(args);
      return args.select.city ? { city: "Test city" } : { phone: "private-phone", whatsapp: "081234567890", email: "private@example.test", addressLine: "private-address", visibleToMembers: visible };
    } },
    // Halaman kini menarik daftar memori; kosongkan agar fokus tes tetap timeline.
    personMemory: { findMany: async () => [] },
  };
  const output = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const exports: { default?: (props: { params: Promise<{ id: string }> }) => Promise<React.ReactNode> } = {};
  runInNewContext(output, { exports, require: (id: string) => {
    if (id === "@/lib/prisma") return { prisma };
    if (id === "@/lib/auth") return { auth: async () => role ? { user: { id: "viewer" } } : null };
    if (id === "@/lib/genealogy") return { getImmediateFamily: async () => null, getClassifiedSiblings: async () => [] };
    if (id === "@/lib/profile") return require(resolve("src/lib/profile.ts"));
    if (id === "@/components/profile/ProfileCard") return { ProfileCard: (props: Record<string, unknown>) => { cardProps = props; return "ProfileCard"; } };
    if (id === "@/components/profil/FamilyPanel") return { FamilyPanel: () => null };
    if (id === "next/link") return { default: () => null };
    if (id === "next/navigation") return { notFound: () => { throw new Error("notFound"); } };
    return require(id.startsWith("@/") ? resolve("src", id.slice(2)) : id);
  } }, { filename });
  const node = await exports.default!({ params: Promise.resolve({ id: "p1" }) });
  const markup = renderToStaticMarkup(node);
  return { cardProps: cardProps as Record<string, unknown> | null, privateQueries, markup };
}

test("guest public page fetches only city and never passes private fields", async () => {
  const { cardProps, privateQueries } = await renderPage();
  assert.equal(privateQueries.length, 1);
  assert.deepEqual(Object.keys(privateQueries[0].select), ["city"]);
  assert.equal(cardProps?.contacts, null);
  const profile = cardProps?.profile as Record<string, unknown>;
  assert.equal(profile.city, "Test city");
  assert.equal(JSON.stringify(profile).includes("phone"), false);
  assert.equal(JSON.stringify(profile).includes("email"), false);
});

test("MEMBER viewer sees consenting contacts from the viewer's role", async () => {
  const { cardProps } = await renderPage("MEMBER");
  const contacts = cardProps?.contacts as Record<string, unknown> | null;
  assert.equal(contacts?.phone, "private-phone");
  assert.equal(contacts?.whatsapp, "081234567890");
});

test("consent false and unknown viewer roles hide contacts", async () => {
  for (const [role, visible] of [["SUPER_ADMIN", false], ["UNKNOWN", true]] as const) {
    const { cardProps } = await renderPage(role, visible);
    assert.equal(cardProps?.contacts, null);
  }
});

test("halaman merender panel timeline dan peta", async () => {
  const { markup } = await renderPage();
  assert.ok(markup.includes("Jejak Hidup"));
  assert.ok(markup.includes("Universitas Gadjah Mada"));
  assert.ok(markup.includes("Tampilkan peta"));
  assert.ok(markup.includes("OpenStreetMap contributors"));
});

test("tamu tidak melihat event privat, anggota melihatnya", async () => {
  const guest = await renderPage();
  assert.equal(guest.markup.includes("Catatan pribadi"), false);
  assert.equal(guest.markup.includes("Rincian privat"), false);
  // Event CUSTOM berkordinat tetap tampil untuk tamu karena dipakai peta
  assert.ok(guest.markup.includes("Haji"));

  const member = await renderPage("MEMBER");
  assert.ok(member.markup.includes("Catatan pribadi"));
});

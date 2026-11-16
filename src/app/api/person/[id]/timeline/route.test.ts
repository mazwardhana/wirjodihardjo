import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Helper lokal dengan pola transpileModule yang sama seperti
// tests/helpers/profile-route.ts. Helper itu tidak mendukung person.findFirst
// maupun pemetaan "@/lib/timeline", jadi fixture disiapkan di sini tanpa
// mengubah berkas helper bersama.

const ROUTE = resolve("src/app/api/person/[id]/timeline/route.ts");

const PERSON_ID = "11111111-1111-4111-8111-111111111111";

function fixture() {
  const state = {
    session: null as { user: { id: string } } | null,
    person: {
      id: PERSON_ID,
      birthDate: new Date(1962, 4, 12),
      birthPlace: "Yogyakarta",
      deathDate: null,
      deathPlace: null,
      isDeceased: false,
      lifeEvents: [
        {
          id: "le-geo",
          kind: "CUSTOM",
          title: "Haji",
          description: "Rahasia keluarga",
          locationName: "Makkah",
          latitude: 21.4225,
          longitude: 39.8262,
          date: new Date(1995, 6, 20),
          datePrecision: "MONTH",
        },
        {
          id: "le-no-geo",
          kind: "CUSTOM",
          title: "Catatan pribadi",
          description: "Harusnya tamu tidak lihat",
          locationName: "Rumah",
          latitude: null,
          longitude: null,
          date: new Date(2000, 0, 1),
          datePrecision: "DAY",
        },
        {
          id: "le-job",
          kind: "OCCUPATION",
          title: "Pensiun",
          description: "Detail pekerjaan",
          locationName: "Kantor",
          latitude: -7.7956,
          longitude: 110.3695,
          date: new Date(2010, 0, 1),
          datePrecision: "YEAR",
        },
        {
          id: "le-birth",
          kind: "BIRTH",
          title: "Duplikat lahir",
          description: null,
          locationName: null,
          latitude: null,
          longitude: null,
          date: new Date(1962, 4, 12),
          datePrecision: "DAY",
        },
      ],
      education: [
        {
          id: "edu-1",
          institution: "Universitas Gadjah Mada",
          degree: "S1",
          fieldOfStudy: "Kedokteran",
          startYear: 1980,
          endYear: 1986,
        },
      ],
    } as unknown,
    queries: [] as Array<Record<string, unknown>>,
  };
  const prisma = {
    person: {
      findFirst: async (args: Record<string, unknown>) => {
        state.queries.push(args);
        return state.person;
      },
    },
  };
  return { state, prisma };
}

function loadRoute(f: ReturnType<typeof fixture>) {
  const require = createRequire(ROUTE);
  const output = ts.transpileModule(readFileSync(ROUTE, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const exports: Record<string, (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>> = {};
  const requireMap = (id: string): unknown => {
    if (id === "@/lib/auth") return { auth: async () => f.state.session };
    if (id === "@/lib/prisma") return { prisma: f.prisma };
    if (id === "@/lib/timeline") {
      const mod = resolve("src/lib/timeline.ts");
      const inner = ts.transpileModule(readFileSync(mod, "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      }).outputText;
      const modExports: Record<string, unknown> = {};
      runInNewContext(inner, { exports: modExports, require: requireMap }, { filename: mod });
      return modExports;
    }
    return require(id);
  };
  runInNewContext(output, { exports, require: requireMap, Response, URL }, { filename: ROUTE });
  return exports;
}

function request(id: string) {
  return new Request(`http://localhost/api/person/${id}/timeline`, { method: "GET" });
}

const context = (id: string) => ({ params: Promise.resolve({ id }) });

type EventView = { key: string; kind: string; title: string; description: string | null; latitude: number | null; name?: string };

test("id bentuk tidak valid ditolak 400 tanpa query", async () => {
  const f = fixture();
  const route = loadRoute(f);
  const response = await route.GET(request("bukan-uuid"), context("bukan-uuid"));
  assert.equal(response.status, 400);
  assert.equal(f.state.queries.length, 0);
});

test("person tidak ada atau tidak publik ditolak 404", async () => {
  const f = fixture();
  f.state.person = null as unknown as ReturnType<typeof fixture>["state"]["person"];
  const route = loadRoute(f);
  const response = await route.GET(request(PERSON_ID), context(PERSON_ID));
  assert.equal(response.status, 404);
});

test("query hanya mengambil person publik yang belum dihapus", async () => {
  const f = fixture();
  const route = loadRoute(f);
  await route.GET(request(PERSON_ID), context(PERSON_ID));
  const where = f.state.queries[0].where as Record<string, unknown>;
  assert.equal(where.id, PERSON_ID);
  assert.equal(where.deletedAt, null);
  assert.equal(where.isPublicProfile, true);
});

test("tamu hanya menerima event lahir, wafat, pendidikan, dan yang berkordinat", async () => {
  const f = fixture();
  f.state.session = null;
  const route = loadRoute(f);
  const response = await route.GET(request(PERSON_ID), context(PERSON_ID));
  assert.equal(response.status, 200);
  const body = (await response.json()) as { events: EventView[]; points: EventView[] };
  const kinds = body.events.map((e) => e.kind);
  assert.ok(kinds.includes("BIRTH"));
  assert.ok(kinds.includes("EDUCATION"));
  // CUSTOM berkordinat tetap tampil, tapi deskripsinya dipangkas
  const custom = body.events.find((e) => e.key === "event:le-geo");
  assert.ok(custom);
  assert.equal(custom.description, null);
  // OCCUPATION berkordinat juga dipangkas deskripsinya
  const occupation = body.events.find((e) => e.key === "event:le-job");
  assert.ok(occupation);
  assert.equal(occupation.description, null);
  // CUSTOM tanpa kordinat tidak boleh bocor ke tamu
  assert.equal(body.events.find((e) => e.key === "event:le-no-geo"), undefined);
  // life-event BIRTH redundan dengan event virtual
  assert.equal(body.events.filter((e) => e.kind === "BIRTH").length, 1);
  // deskripsi pendidikan dipangkas untuk tamu
  const edu = body.events.find((e) => e.kind === "EDUCATION");
  assert.equal(edu?.description, null);
  // titik peta hanya dari event yang lolos
  assert.equal(body.points.length, 2);
  assert.ok(body.points.every((p) => p.name !== "Rumah"));
});

test("tamu mendapat Cache-Control publik dengan max-age 300", async () => {
  const f = fixture();
  f.state.session = null;
  const route = loadRoute(f);
  const response = await route.GET(request(PERSON_ID), context(PERSON_ID));
  assert.equal(response.headers.get("Cache-Control"), "public, max-age=300");
});

test("anggota login menerima semua event dan cache privat", async () => {
  const f = fixture();
  f.state.session = { user: { id: "u1" } };
  const route = loadRoute(f);
  const response = await route.GET(request(PERSON_ID), context(PERSON_ID));
  assert.equal(response.status, 200);
  const body = (await response.json()) as { events: EventView[] };
  assert.ok(body.events.find((e) => e.key === "event:le-no-geo"));
  const custom = body.events.find((e) => e.key === "event:le-geo");
  assert.equal(custom?.description, "Rahasia keluarga");
  assert.equal(response.headers.get("Cache-Control"), "private, max-age=0");
});

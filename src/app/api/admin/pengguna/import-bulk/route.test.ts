import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// ─── Route loader ─────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

function makeFakePrisma(persons: Row[], users: Row[], created: Row[]) {
  return {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const u = (users as Array<Row & { id: string }>).find((x) => x.id === where.id) ??
          (where.id === "u1" ? { id: "u1", role: "SUPER_ADMIN", isActive: true } : null);
        if (!u) return null;
        return {
          role: u.role,
          branchAdminOf: u.branchAdminOf ?? null,
          isActive: u.isActive ?? true,
        };
      },
      findMany: async ({ where }: { where: { OR: Array<Record<string, { in: string[] }>> } }) => {
        const out: Row[] = [];
        for (const clause of where.OR) {
          if (clause.username) {
            for (const u of users as Array<Row & { username: string }>) {
              if (clause.username.in.includes(u.username)) out.push(u);
            }
          } else if (clause.email) {
            for (const u of users as Array<Row & { email: string | null }>) {
              if (u.email && clause.email.in.includes(u.email)) out.push(u);
            }
          } else if (clause.personId) {
            for (const u of users as Array<Row & { personId: string }>) {
              if (clause.personId.in.includes(u.personId)) out.push(u);
            }
          }
        }
        return out;
      },
      create: async ({ data }: { data: Row }) => {
        const user = { id: `gen-${created.length + 1}`, ...data };
        created.push(user as Row);
        return user;
      },
    },
    person: {
      findMany: async ({ where }: { where: { fullName: { in: string[] } } }) => {
        const names: string[] = where.fullName.in;
        return (persons as Array<Row & { fullName: string; deletedAt?: Date | null }>).filter(
          (p) => p.deletedAt == null && names.some((n) => n.toLowerCase() === p.fullName.toLowerCase()),
        );
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(makeFakePrisma(persons, users, created)),
  };
}

type RouteState = {
  session: { user: { id: string; role: string } } | null;
  persons: Row[];
  users: Row[];
  created: Row[];
  audits: Row[];
};

function loadRoute(state: RouteState) {
  const filename = resolve("src/app/api/admin/pengguna/import-bulk/route.ts");
  const nodeRequire = createRequire(filename);

  const fakePrisma = makeFakePrisma(state.persons, state.users, state.created);

  const rbacFilename = resolve("src/lib/rbac.ts");
  const rbacOutput = ts.transpileModule(readFileSync(rbacFilename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  const rbacExports: Record<string, unknown> = {};
  runInNewContext(rbacOutput.outputText, {
    exports: rbacExports,
    module: { exports: rbacExports },
    require: (id: string) =>
      id === "@/lib/prisma" ? { prisma: fakePrisma } : nodeRequire(id),
  }, { filename: rbacFilename });

  function loadModule(modPath: string) {
    const fullPath = resolve(modPath);
    const output = ts.transpileModule(readFileSync(fullPath, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    });
    const m = { exports: {} };
    runInNewContext(output.outputText, {
      exports: m.exports,
      module: m,
      require: (id: string) => {
        if (id === "@/lib/prisma") return { prisma: fakePrisma };
        if (id === "@/lib/rbac") return rbacExports;
        if (id === "bcryptjs") return nodeRequire("bcryptjs");
        if (id === "zod") return nodeRequire("zod");
        if (id === "csv-parse/sync") return nodeRequire("csv-parse/sync");
        return nodeRequire(id);
      },
    }, { filename: fullPath });
    return m.exports;
  }

  const routeOutput = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  const routeExports: Record<string, unknown> = {};
  runInNewContext(routeOutput.outputText, {
    exports: routeExports,
    module: { exports: routeExports },
    File,
    FormData,
    URL,
    Request,
    Response,
    console,
    require: (id: string) => {
      if (id === "@/lib/auth") return { auth: async () => state.session };
      if (id === "@/lib/prisma") return { prisma: fakePrisma };
      if (id === "@/lib/rbac") return rbacExports;
      if (id === "@/lib/audit") return { logAudit: async (p: Row) => { state.audits.push(p); } };
      if (id === "@/lib/user-import/parser") return loadModule("src/lib/user-import/parser.ts");
      if (id === "@/lib/user-import/validator") return loadModule("src/lib/user-import/validator.ts");
      if (id === "@/lib/user-import/importer") return loadModule("src/lib/user-import/importer.ts");
      return nodeRequire(id);
    },
  }, { filename });

  return routeExports as { POST: (request: Request) => Promise<Response> };
}

function csvForm(csv: string, action = "preview"): FormData {
  const form = new FormData();
  const file = new File([csv], "users.csv", { type: "text/csv" });
  form.append("file", file, "users.csv");
  form.append("action", action);
  return form;
}

async function jsonBody(body: unknown): Promise<unknown> {
  return body;
}

// ─── Authorization tests ─────────────────────────────────────────────────────

import { describe, test } from "node:test";

describe("POST /api/admin/pengguna/import-bulk — authorization", () => {
  test("returns 401 when not authenticated", async () => {
    const state: RouteState = { session: null, persons: [], users: [], created: [], audits: [] };
    const route = loadRoute(state);
    const req = new Request("http://localhost", {
      method: "POST",
      body: csvForm("budi_w,Pass1!,Budi,\n"),
    });
    const res = await route.POST(req);
    assert.equal(res.status, 401);
  });

  test("returns 403 when session user is BRANCH_ADMIN", async () => {
    const state: RouteState = {
      session: { user: { id: "u2", role: "BRANCH_ADMIN" } },
      persons: [],
      users: [{ id: "u2", role: "BRANCH_ADMIN", branchAdminOf: { id: "b1" }, isActive: true }],
      created: [],
      audits: [],
    };
    const route = loadRoute(state);
    const req = new Request("http://localhost", {
      method: "POST",
      body: csvForm("budi_w,Pass1!,Budi,\n"),
    });
    const res = await route.POST(req);
    assert.equal(res.status, 403);
    assert.equal(state.created.length, 0);
  });

  test("returns 403 when session user is MEMBER", async () => {
    const state: RouteState = {
      session: { user: { id: "u3", role: "MEMBER" } },
      persons: [],
      users: [{ id: "u3", role: "MEMBER", isActive: true }],
      created: [],
      audits: [],
    };
    const route = loadRoute(state);
    const req = new Request("http://localhost", {
      method: "POST",
      body: csvForm("budi_w,Pass1!,Budi,\n"),
    });
    const res = await route.POST(req);
    assert.equal(res.status, 403);
    assert.equal(state.created.length, 0);
  });

  test("allows SUPER_ADMIN", async () => {
    const state: RouteState = {
      session: { user: { id: "u1", role: "SUPER_ADMIN" } },
      persons: [],
      users: [{ id: "u1", role: "SUPER_ADMIN", isActive: true }],
      created: [],
      audits: [],
    };
    const route = loadRoute(state);
    const req = new Request("http://localhost", {
      method: "POST",
      body: csvForm("budi_w,Pass1!,Budi,\n"),
    });
    const res = await route.POST(req);
    // No parse error yet — will fail parsing but 4xx not 5xx
    assert.ok(res.status < 500, `Expected non-5xx, got ${res.status}`);
  });
});

// ─── Preview tests ───────────────────────────────────────────────────────────

describe("POST /api/admin/pengguna/import-bulk — preview", () => {
  test("returns valid=true and matched list for correct CSV", async () => {
    const state: RouteState = {
      session: { user: { id: "u1", role: "SUPER_ADMIN" } },
      persons: [{ id: "p1", fullName: "Budi Wirjodihardjo", deletedAt: null }],
      users: [],
      created: [],
      audits: [],
    };
    const route = loadRoute(state);
    const csv = "username,password,nama_lengkap,email\nbudi_w,Password123!,Budi Wirjodihardjo,budi@example.com\n";
    const req = new Request("http://localhost", {
      method: "POST",
      body: csvForm(csv, "preview"),
    });
    const res = await route.POST(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.valid, true);
    assert.equal(body.matched.length, 1);
    assert.equal(body.matched[0].username, "budi_w");
    assert.equal(body.matched[0].personId, "p1");
    assert.equal(body.matched[0].personName, "Budi Wirjodihardjo");
    assert.equal(body.matched[0].email, "budi@example.com");
    // Password must not be exposed
    assert.ok(!("password" in body.matched[0]), "password should not be in preview response");
  });

  test("returns matched persons for multiple valid rows", async () => {
    const state: RouteState = {
      session: { user: { id: "u1", role: "SUPER_ADMIN" } },
      persons: [
        { id: "p1", fullName: "Budi Wirjodihardjo", deletedAt: null },
        { id: "p2", fullName: "Siti Aminah", deletedAt: null },
      ],
      users: [],
      created: [],
      audits: [],
    };
    const route = loadRoute(state);
    const csv =
      "username,password,nama_lengkap,email\n" +
      "budi_w,PasswordOne123!,Budi Wirjodihardjo,budi@example.com\n" +
      "siti_a,PasswordTwo456!,Siti Aminah,siti@example.com\n";
    const req = new Request("http://localhost", {
      method: "POST",
      body: csvForm(csv, "preview"),
    });
    const res = await route.POST(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.valid, true);
    assert.equal(body.matched.length, 2);
  });

  test("reports unmatched person", async () => {
    const state: RouteState = {
      session: { user: { id: "u1", role: "SUPER_ADMIN" } },
      persons: [],
      users: [],
      created: [],
      audits: [],
    };
    const route = loadRoute(state);
    const csv = "username,password,nama_lengkap,email\nxyz_u,Pass1!,Tidak Ada Orang,b@x.com\n";
    const req = new Request("http://localhost", {
      method: "POST",
      body: csvForm(csv, "preview"),
    });
    const res = await route.POST(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.valid, false);
    assert.ok(body.errors.some((e: Row) => e.field === "nama_lengkap" && /tidak ditemukan/.test(e.message as string)));
  });

  test("reports duplicate username in batch", async () => {
    const state: RouteState = {
      session: { user: { id: "u1", role: "SUPER_ADMIN" } },
      persons: [
        { id: "p1", fullName: "Budi Wirjodihardjo", deletedAt: null },
        { id: "p2", fullName: "Siti Aminah", deletedAt: null },
      ],
      users: [],
      created: [],
      audits: [],
    };
    const route = loadRoute(state);
    const csv = "username,password,nama_lengkap,email\n" +
      "budi_w,Pass1!,Budi Wirjodihardjo,\n" +
      "BUDI_W,Pass2!,Siti Aminah,\n";
    const req = new Request("http://localhost", {
      method: "POST",
      body: csvForm(csv, "preview"),
    });
    const res = await route.POST(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.valid, false);
    assert.ok(body.conflicts.usernames.includes("BUDI_W") || body.errors.some((e: Row) => /sudah digunakan/.test(e.message as string)));
  });

  test("reports existing username in DB", async () => {
    const state: RouteState = {
      session: { user: { id: "u1", role: "SUPER_ADMIN" } },
      persons: [{ id: "p1", fullName: "Budi Wirjodihardjo", deletedAt: null }],
      users: [{ username: "budi_w", email: null, personId: "p-other" }],
      created: [],
      audits: [],
    };
    const route = loadRoute(state);
    const csv = "username,password,nama_lengkap,email\nbudi_w,Password123!,Budi Wirjodihardjo,\n";
    const req = new Request("http://localhost", {
      method: "POST",
      body: csvForm(csv, "preview"),
    });
    const res = await route.POST(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.valid, false);
    assert.ok(body.conflicts.usernames.includes("budi_w"));
  });

  test("does NOT call user.create on preview", async () => {
    const state: RouteState = {
      session: { user: { id: "u1", role: "SUPER_ADMIN" } },
      persons: [{ id: "p1", fullName: "Budi Wirjodihardjo", deletedAt: null }],
      users: [],
      created: [],
      audits: [],
    };
    const route = loadRoute(state);
    const csv = "username,password,nama_lengkap,email\nbudi_w,Password123!,Budi Wirjodihardjo,\n";
    const req = new Request("http://localhost", {
      method: "POST",
      body: csvForm(csv, "preview"),
    });
    await route.POST(req);
    assert.equal(state.created.length, 0);
  });
});

// ─── Commit tests ───────────────────────────────────────────────────────────

describe("POST /api/admin/pengguna/import-bulk — commit", () => {
  test("creates users with correct fields on commit", async () => {
    const state: RouteState = {
      session: { user: { id: "u1", role: "SUPER_ADMIN" } },
      persons: [{ id: "p1", fullName: "Budi Wirjodihardjo", deletedAt: null }],
      users: [],
      created: [],
      audits: [],
    };
    const route = loadRoute(state);
    const csv = "username,password,nama_lengkap,email\nbudi_w,Password123!,Budi Wirjodihardjo,budi@example.com\n";
    const req = new Request("http://localhost", {
      method: "POST",
      body: csvForm(csv, "commit"),
    });
    const res = await route.POST(req);
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.created, 1);
    assert.equal(state.created.length, 1);
    const u = state.created[0];
    assert.equal(u.username, "budi_w");
    assert.equal(u.email, "budi@example.com");
    assert.equal(u.role, "MEMBER");
    assert.equal(u.isActive, true);
    assert.equal(u.mustChangeCredentials, true);
    assert.equal(u.personId, "p1");
    assert.equal(u.createdById, "u1");
    // Password must be hashed, not plaintext
    assert.ok((u.passwordHash as string).startsWith("$2"));
    assert.notEqual(u.passwordHash, "Password123!");
  });

  test("rejects commit when validation fails", async () => {
    const state: RouteState = {
      session: { user: { id: "u1", role: "SUPER_ADMIN" } },
      persons: [],
      users: [],
      created: [],
      audits: [],
    };
    const route = loadRoute(state);
    const csv = "username,password,nama_lengkap,email\nbudi_w,Pass1!,Tidak Ada,b@x.com\n";
    const req = new Request("http://localhost", {
      method: "POST",
      body: csvForm(csv, "commit"),
    });
    const res = await route.POST(req);
    assert.equal(res.status, 400);
    assert.equal(state.created.length, 0);
  });

  test("never creates users for unmatched persons", async () => {
    const state: RouteState = {
      session: { user: { id: "u1", role: "SUPER_ADMIN" } },
      persons: [
        { id: "p1", fullName: "Budi Wirjodihardjo", deletedAt: null },
      ],
      users: [],
      created: [],
      audits: [],
    };
    const route = loadRoute(state);
    const csv = "username,password,nama_lengkap,email\n" +
      "budi_w,Pass1!,Budi Wirjodihardjo,\n" +   // matched
      "siti_a,Pass2!,Siti Aminah,\n";           // not matched
    const req = new Request("http://localhost", {
      method: "POST",
      body: csvForm(csv, "commit"),
    });
    const res = await route.POST(req);
    assert.equal(res.status, 400);
    assert.equal(state.created.length, 0);
  });

  test("logs audit entry on successful commit", async () => {
    const state: RouteState = {
      session: { user: { id: "u1", role: "SUPER_ADMIN" } },
      persons: [{ id: "p1", fullName: "Budi Wirjodihardjo", deletedAt: null }],
      users: [],
      created: [],
      audits: [],
    };
    const route = loadRoute(state);
    const csv = "username,password,nama_lengkap,email\nbudi_w,Password123!,Budi Wirjodihardjo,\n";
    const req = new Request("http://localhost", {
      method: "POST",
      body: csvForm(csv, "commit"),
    });
    await route.POST(req);
    assert.ok(state.audits.length >= 1, "At least one audit entry expected");
    const audit = state.audits[0] as Row;
    assert.equal(audit.actorUserId, "u1");
  });

  test("handles null email on commit", async () => {
    const state: RouteState = {
      session: { user: { id: "u1", role: "SUPER_ADMIN" } },
      persons: [{ id: "p1", fullName: "Budi Wirjodihardjo", deletedAt: null }],
      users: [],
      created: [],
      audits: [],
    };
    const route = loadRoute(state);
    const csv = "username,password,nama_lengkap,email\nbudi_w,Password123!,Budi Wirjodihardjo,\n";
    const req = new Request("http://localhost", {
      method: "POST",
      body: csvForm(csv, "commit"),
    });
    const res = await route.POST(req);
    assert.equal(res.status, 201);
    assert.equal(state.created[0].email, null);
  });
});

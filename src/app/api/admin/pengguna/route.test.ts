import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";
import { describe, test } from "node:test";

type Row = Record<string, unknown>;
type PrismaMock = Record<string, any>;

type UserRow = {
  id: string;
  role: string;
  email: string | null;
  username: string | null;
  personId: string | null;
  isActive: boolean;
  isVerified: boolean;
};

function fixture() {
  const state = {
    session: { user: { id: "u1", role: "SUPER_ADMIN" } } as
      | { user: { id: string; role: string } }
      | null,
    users: {
      u1: {
        id: "u1",
        role: "SUPER_ADMIN",
        email: "admin@contoh.id",
        username: "admin",
        personId: "p9",
        isActive: true,
        isVerified: true,
      },
      u2: {
        id: "u2",
        role: "MEMBER",
        email: "anggota@contoh.id",
        username: "anggota",
        personId: "p2",
        isActive: true,
        isVerified: false,
      },
    } as Record<string, UserRow>,
    queries: [] as Row[],
    updates: [] as Row[],
    creates: [] as Row[],
    deletes: [] as Row[],
    // Hasil logAudit (mock @/lib/audit) dan prisma.auditLog.create.
    logs: [] as Row[],
    auditRows: [] as Row[],
  };
  return { state };
}

function makePrisma(state: ReturnType<typeof fixture>["state"]): PrismaMock {
  const prisma: PrismaMock = {
    user: {
      findUnique: async (args: { where: Row }) => {
        state.queries.push(args.where);
        const where = args.where;
        const all = Object.values(state.users);
        if (typeof where.id === "string") return state.users[where.id] ?? null;
        if (typeof where.email === "string") {
          return all.find((u) => u.email === where.email) ?? null;
        }
        if (typeof where.personId === "string") {
          return all.find((u) => u.personId === where.personId) ?? null;
        }
        if (typeof where.username === "string") {
          return all.find((u) => u.username === where.username) ?? null;
        }
        return null;
      },
      findMany: async () => Object.values(state.users),
      update: async (args: { where: { id: string }; data: Row }) => {
        state.updates.push(args.data);
        const target = state.users[args.where.id];
        return target ? { ...target, ...args.data } : { id: args.where.id, ...args.data };
      },
      create: async (args: { data: Row }) => {
        state.creates.push(args.data);
        return { id: `baru-${state.creates.length}`, ...args.data };
      },
      delete: async (args: { where: { id: string } }) => {
        state.deletes.push(args.where);
        return state.users[args.where.id] ?? null;
      },
    },
    person: {
      findUnique: async (args: { where: { id: string } }) => ({
        id: args.where.id,
        fullName: "Anggota Uji",
      }),
      findMany: async () => [],
    },
    auditLog: {
      create: async (args: Row) => {
        state.auditRows.push(args);
        return args;
      },
    },
    branch: {
      updateMany: async () => ({ count: 0 }),
    },
  };
  prisma.$transaction = async (fn: (tx: PrismaMock) => Promise<unknown>) => fn(prisma);
  return prisma;
}

type Handler = (request: Request) => Promise<Response>;
type Handlers = Partial<Record<"GET" | "POST" | "PUT" | "DELETE", Handler>>;
type RequireMap = (id: string) => unknown;

// Memuat modul TS asli ke dalam konteks VM terpisah dengan dependensi diganti mock.
function loadModule(filename: string, requireMap: RequireMap) {
  const abs = resolve(filename);
  const output = ts.transpileModule(readFileSync(abs, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} as Record<string, unknown> };
  runInNewContext(
    output,
    {
      exports: module.exports,
      module,
      URL,
      Request,
      Response,
      console,
      process,
      setTimeout,
      clearTimeout,
      require: requireMap,
    },
    { filename: abs },
  );
  return module.exports;
}

function loadPenggunaRoute(f: ReturnType<typeof fixture>): Handlers {
  const routePath = "src/app/api/admin/pengguna/route.ts";
  const nodeRequire = createRequire(resolve(routePath));
  const prisma = makePrisma(f.state);

  const authModule = { auth: async () => f.state.session };
  const auditModule = {
    logAudit: async (params: Row) => {
      f.state.logs.push(params);
    },
  };
  const branchModule = {
    clearBranchAdminOnDemotion: async () => {},
    validateBranchAdminAssignment: async () => {},
    BranchAdminValidationError: class BranchAdminValidationError extends Error {},
  };

  return loadModule(routePath, (id) => {
    if (id === "@/lib/auth") return authModule;
    if (id === "@/lib/prisma") return { prisma };
    if (id === "@/lib/audit") return auditModule;
    if (id === "@/lib/branch-admin-validation") return branchModule;
    return nodeRequire(id);
  }) as Handlers;
}

function jsonRequest(method: string, body: unknown) {
  return new Request("http://localhost/api/admin/pengguna", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("API admin pengguna: flag kredensial", () => {
  test("reset-password menulis mustChangeCredentials, bukan mustChangePassword", async () => {
    const f = fixture();
    const route = loadPenggunaRoute(f);
    const response = await route.POST!(jsonRequest("POST", {
      action: "reset-password",
      userId: "u2",
    }));
    assert.equal(response.status, 200);

    assert.equal(f.state.updates.length, 1);
    const data = f.state.updates[0];
    assert.equal(data.mustChangeCredentials, true);
    assert.ok(!("mustChangePassword" in data), "mustChangePassword tidak boleh ditulis");
    assert.equal(data.passwordResetToken, null);
    assert.equal(data.passwordResetExpires, null);
    assert.ok(
      typeof data.passwordHash === "string" && (data.passwordHash as string).startsWith("$2"),
      "password harus tersimpan ter-hash",
    );
    assert.equal(f.state.logs.length, 1);
    assert.equal(f.state.logs[0].action, "USER_RESET_PASSWORD");
  });

  test("PUT meneruskan mustChangeCredentials ke user.update", async () => {
    const f = fixture();
    const route = loadPenggunaRoute(f);
    const response = await route.PUT!(jsonRequest("PUT", {
      id: "u2",
      mustChangeCredentials: true,
    }));
    assert.equal(response.status, 200);

    assert.equal(f.state.updates.length, 1);
    const data = f.state.updates[0];
    assert.equal(data.mustChangeCredentials, true);
    assert.ok(!("mustChangePassword" in data), "mustChangePassword tidak boleh ikut terkirim");
  });

  test("PUT mengabaikan nama lama mustChangePassword", async () => {
    const f = fixture();
    const route = loadPenggunaRoute(f);
    const response = await route.PUT!(jsonRequest("PUT", {
      id: "u2",
      mustChangePassword: true,
    }));
    assert.equal(response.status, 200);

    assert.equal(f.state.updates.length, 1);
    assert.ok(
      !("mustChangePassword" in f.state.updates[0]),
      "field lama harus diabaikan sepenuhnya",
    );
  });

  test("Non-SUPER_ADMIN ditolak 403 tanpa tulisan apa pun", async () => {
    const f = fixture();
    f.state.session = { user: { id: "u2", role: "MEMBER" } };
    const route = loadPenggunaRoute(f);

    const post = await route.POST!(jsonRequest("POST", {
      action: "reset-password",
      userId: "u1",
    }));
    assert.equal(post.status, 403);

    const put = await route.PUT!(jsonRequest("PUT", {
      id: "u1",
      mustChangeCredentials: true,
    }));
    assert.equal(put.status, 403);

    assert.equal(f.state.updates.length, 0);
    assert.equal(f.state.creates.length, 0);
    assert.equal(f.state.deletes.length, 0);
    assert.equal(f.state.logs.length, 0);
  });
});

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

type Row = Record<string, any>;

type State = {
  session: { user: { id: string; role: string } } | null;
  adminUser: Row | null;
  albums: Row[];
  album: Row | null;
  updated: Row[];
  deleted: string[];
};

function fixture(): State {
  return {
    session: null,
    adminUser: null,
    albums: [],
    album: null,
    updated: [],
    deleted: [],
  };
}

type RouteExports = {
  GET: () => Promise<Response>;
  PUT: (request: Request) => Promise<Response>;
  DELETE: (request: Request) => Promise<Response>;
};

function loadRoute(state: State): RouteExports {
  const filename = resolve("src/app/api/admin/galeri/route.ts");
  const nativeRequire = createRequire(filename);
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const exports: Record<string, unknown> = {};
  runInNewContext(
    output,
    {
      exports,
      module: { exports },
      Request,
      Response,
      URL,
      require: (id: string) => {
        if (id === "@/lib/auth") return { auth: async () => state.session };
        if (id === "@/lib/audit") return { logAudit: async () => undefined };
        if (id === "@/lib/prisma") {
          return {
            prisma: {
              user: {
                findUnique: async () => state.adminUser,
              },
              album: {
                findMany: async () => state.albums,
                findUnique: async () => state.album,
                update: async ({ where, data }: { where: { id: string }; data: Row }) => {
                  const updated = { ...state.album, ...data };
                  state.updated.push(updated);
                  return updated;
                },
                delete: async ({ where }: { where: { id: string } }) => {
                  state.deleted.push(where.id);
                  return state.album;
                },
                create: async ({ data }: { data: Row }) => data,
              },
            },
          };
        }
        return nativeRequire(id);
      },
    },
    { filename },
  );

  return exports as RouteExports;
}

function album(id: string, branchId: string | null): Row {
  return {
    id,
    title: `Album ${id}`,
    slug: id,
    isPublished: false,
    media: branchId === null ? [] : [{ uploader: { person: { branchId } } }],
    _count: { media: 1 },
    createdBy: null,
    publishedBy: null,
  };
}

function adminRequest(body: Row): Request {
  return new Request("http://localhost/api/admin/galeri", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/admin/galeri branch scope", () => {
  test("BRANCH_ADMIN list excludes albums whose media belongs to another branch", async () => {
    const state = fixture();
    state.session = { user: { id: "admin-A", role: "BRANCH_ADMIN" } };
    state.adminUser = { id: "admin-A", role: "BRANCH_ADMIN", branchAdminOf: { id: "branch-A" } };
    state.albums = [album("own", "branch-A"), album("other", "branch-B"), album("legacy", null)];

    const response = await loadRoute(state).GET();
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).map((row: Row) => row.id), ["own"]);
  });

  test("BRANCH_ADMIN cannot update an album whose media belongs to another branch", async () => {
    const state = fixture();
    state.session = { user: { id: "admin-A", role: "BRANCH_ADMIN" } };
    state.adminUser = { id: "admin-A", role: "BRANCH_ADMIN", branchAdminOf: { id: "branch-A" } };
    state.album = album("other", "branch-B");

    const response = await loadRoute(state).PUT(adminRequest({ id: "other", title: "Changed" }));
    assert.equal(response.status, 403);
    assert.equal(state.updated.length, 0);
  });

  test("BRANCH_ADMIN cannot delete an unscoped album", async () => {
    const state = fixture();
    state.session = { user: { id: "admin-A", role: "BRANCH_ADMIN" } };
    state.adminUser = { id: "admin-A", role: "BRANCH_ADMIN", branchAdminOf: { id: "branch-A" } };
    state.album = album("legacy", null);

    const response = await loadRoute(state).DELETE(
      new Request("http://localhost/api/admin/galeri?id=legacy"),
    );
    assert.equal(response.status, 403);
    assert.deepEqual(state.deleted, []);
  });

  test("SUPER_ADMIN can manage an unscoped album", async () => {
    const state = fixture();
    state.session = { user: { id: "super", role: "SUPER_ADMIN" } };
    state.adminUser = { id: "super", role: "SUPER_ADMIN", branchAdminOf: null };
    state.album = album("legacy", null);

    const response = await loadRoute(state).PUT(adminRequest({ id: "legacy", title: "Changed" }));
    assert.equal(response.status, 200);
    assert.equal(state.updated.length, 1);
  });
});

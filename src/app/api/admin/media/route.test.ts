import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

/**
 * Gallery Media Moderation Branch Scope Tests
 *
 * Security requirement: BRANCH_ADMIN can only moderate media uploaded by users
 * in their own branch. The uploader's branch is resolved through:
 * GalleryMedia.uploadedByUserId -> User.personId -> Person.branchId
 *
 * For legacy/admin media without an uploader branch, only SUPER_ADMIN may access.
 */

type Row = Record<string, unknown>;

type State = {
  session: { user: { id: string; role: string } } | null;
  adminUser: Row | null;
  media: Row | null;
  album: Row | null;
  queries: Record<string, unknown>[];
  deleted: string[];
  updated: Row[];
};

function fixture(): State {
  return {
    session: null,
    adminUser: null,
    media: null,
    album: null,
    queries: [],
    deleted: [],
    updated: [],
  };
}

type RouteExports = {
  PUT: (request: Request) => Promise<Response>;
  DELETE: (request: Request) => Promise<Response>;
};

function loadRoute(state: State): RouteExports {
  const filename = resolve("src/app/api/admin/media/route.ts");
  const nodeRequire = createRequire(filename);
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
      URL,
      Request,
      Response,
      require: (id: string) => {
        if (id === "@/lib/auth") return { auth: async () => state.session };
        if (id === "@/lib/prisma") {
          return {
            prisma: {
              user: {
                findUnique: async () => state.adminUser ?? (state.session ? {
                  id: state.session.user.id,
                  role: state.session.user.role,
                  branchAdminOf: state.session.user.role === "BRANCH_ADMIN" ? { id: "branch-A" } : null,
                } : null),
              },
              galleryMedia: {
                findUnique: async (args: Record<string, unknown>) => {
                  state.queries.push(args);
                  return state.media;
                },
                update: async ({ where, data }: { where: { id: string }; data: Row }) => {
                  const updated = { ...state.media, ...data };
                  state.updated.push(updated);
                  return updated;
                },
                delete: async ({ where }: { where: { id: string } }) => {
                  state.deleted.push(where.id);
                  return state.media;
                },
              },
              album: {
                findUnique: async () => state.album,
              },
            },
          };
        }
        if (id === "@/lib/audit") return { logAudit: async () => undefined };
        if (id === "@/lib/notifications") return { notifyMediaModeration: async () => undefined };
        if (id === "@/lib/upload") return { UPLOAD_DIR: "/tmp", UPLOAD_URL_PREFIX: "/media", MAX_UPLOAD_BYTES: 5 * 1024 * 1024, ACCEPTED_IMAGE_TYPES: ["image/jpeg", "image/png", "image/webp"] };
        if (id === "fs/promises") return { mkdir: async () => undefined, writeFile: async () => undefined, unlink: async () => undefined };
        if (id === "path") return nodeRequire("path");
        if (id === "crypto") return nodeRequire("crypto");
        return nodeRequire(id);
      },
    },
    { filename },
  );

  return exports as RouteExports;
}

const mediaRow = (overrides: Partial<Row> = {}): Row => ({
  id: "media-1",
  status: "PENDING",
  uploadedByUserId: "user-1",
  albumId: "album-1",
  url: "/media/test.jpg",
  uploader: {
    person: {
      branchId: "branch-A",
    },
  },
  album: {
    title: "Test Album",
  },
  ...overrides,
});

describe("PUT /api/admin/media - branch scope for moderation", () => {
  test("SUPER_ADMIN can moderate any media regardless of uploader branch", async () => {
    const state = fixture();
    state.session = { user: { id: "super-1", role: "SUPER_ADMIN" } };
    state.media = mediaRow({ uploader: { person: { branchId: "branch-B" } } });

    const route = loadRoute(state);
    const response = await route.PUT(
      new Request("http://localhost/api/admin/media", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "media-1", status: "APPROVED" }),
      }),
    );

    assert.equal(response.status, 200);
    assert.equal(state.updated.length, 1);
    assert.equal(state.updated[0].status, "APPROVED");
  });

  test("BRANCH_ADMIN can moderate media uploaded by user in their own branch", async () => {
    const state = fixture();
    state.session = { user: { id: "admin-A", role: "BRANCH_ADMIN" } };
    state.media = mediaRow({ uploader: { person: { branchId: "branch-A" } } });

    const route = loadRoute(state);
    const response = await route.PUT(
      new Request("http://localhost/api/admin/media", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "media-1", status: "APPROVED" }),
      }),
    );

    assert.equal(response.status, 200);
    assert.equal(state.updated.length, 1);
  });

  test("BRANCH_ADMIN cannot moderate media uploaded by user in another branch", async () => {
    const state = fixture();
    state.session = { user: { id: "admin-A", role: "BRANCH_ADMIN" } };
    state.media = mediaRow({ uploader: { person: { branchId: "branch-B" } } });

    const route = loadRoute(state);
    const response = await route.PUT(
      new Request("http://localhost/api/admin/media", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "media-1", status: "APPROVED" }),
      }),
    );

    assert.equal(response.status, 403);
    assert.equal(state.updated.length, 0);
  });

  test("BRANCH_ADMIN cannot moderate legacy media without uploader branch", async () => {
    const state = fixture();
    state.session = { user: { id: "admin-A", role: "BRANCH_ADMIN" } };
    state.media = mediaRow({ uploader: { person: { branchId: null } } });

    const route = loadRoute(state);
    const response = await route.PUT(
      new Request("http://localhost/api/admin/media", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "media-1", status: "APPROVED" }),
      }),
    );

    assert.equal(response.status, 403);
    assert.equal(state.updated.length, 0);
  });

  test("SUPER_ADMIN can moderate legacy media without uploader branch", async () => {
    const state = fixture();
    state.session = { user: { id: "super-1", role: "SUPER_ADMIN" } };
    state.media = mediaRow({ uploader: { person: { branchId: null } } });

    const route = loadRoute(state);
    const response = await route.PUT(
      new Request("http://localhost/api/admin/media", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "media-1", status: "APPROVED" }),
      }),
    );

    assert.equal(response.status, 200);
    assert.equal(state.updated.length, 1);
  });
});

describe("DELETE /api/admin/media - branch scope for deletion", () => {
  test("BRANCH_ADMIN can delete media uploaded by user in their own branch", async () => {
    const state = fixture();
    state.session = { user: { id: "admin-A", role: "BRANCH_ADMIN" } };
    state.media = mediaRow({ uploader: { person: { branchId: "branch-A" } } });

    const route = loadRoute(state);
    const response = await route.DELETE(
      new Request("http://localhost/api/admin/media?id=media-1"),
    );

    assert.equal(response.status, 200);
    assert.deepEqual(state.deleted, ["media-1"]);
  });

  test("BRANCH_ADMIN cannot delete media uploaded by user in another branch", async () => {
    const state = fixture();
    state.session = { user: { id: "admin-A", role: "BRANCH_ADMIN" } };
    state.media = mediaRow({ uploader: { person: { branchId: "branch-B" } } });

    const route = loadRoute(state);
    const response = await route.DELETE(
      new Request("http://localhost/api/admin/media?id=media-1"),
    );

    assert.equal(response.status, 403);
    assert.equal(state.deleted.length, 0);
  });

  test("BRANCH_ADMIN cannot delete legacy media without uploader branch", async () => {
    const state = fixture();
    state.session = { user: { id: "admin-A", role: "BRANCH_ADMIN" } };
    state.media = mediaRow({ uploader: { person: { branchId: null } } });

    const route = loadRoute(state);
    const response = await route.DELETE(
      new Request("http://localhost/api/admin/media?id=media-1"),
    );

    assert.equal(response.status, 403);
    assert.equal(state.deleted.length, 0);
  });
});

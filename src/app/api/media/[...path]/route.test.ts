import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

/**
 * Secure Media Serving Tests
 *
 * The media route must enforce moderation status and album publication before
 * serving a file. These tests load the real route source with only the
 * authentication, persistence and filesystem boundaries replaced, following
 * the same adapter pattern as tests/helpers/profile-route.ts.
 *
 * Covered rules:
 * 1. APPROVED media in a published album -> public (200)
 * 2. PENDING media -> uploader or admin only, private cache
 * 3. REJECTED media -> admin only, private cache
 * 4. APPROVED media in an unpublished album -> not public
 * 5. Unknown filename (avatar, branch cover, article image) -> public, long cache
 * 6. Path traversal and unsupported extensions keep their existing 404/400
 */

type MediaRow = {
  status: "PENDING" | "APPROVED" | "REJECTED";
  uploadedByUserId: string | null;
  album: { isPublished: boolean };
  uploader: { person: { branchId: string | null } } | null;
};

type State = {
  session: { user: { id: string; role: string } } | null;
  adminUser: { branchAdminOf: { id: string } | null } | null;
  media: MediaRow | null;
  queries: Record<string, unknown>[];
  fileMissing: boolean;
};

function fixture(): State {
  return { session: null, adminUser: null, media: null, queries: [], fileMissing: false };
}

type RouteExports = {
  GET: (
    request: Request,
    context: { params: Promise<{ path: string[] }> },
  ) => Promise<Response>;
};

// Load the real route source with only the external boundaries replaced.
// Node's test runner has no mock.module on this version; the VM adapter keeps
// the substitution confined to tests.
function loadRoute(state: State): RouteExports {
  const filename = resolve("src/app/api/media/[...path]/route.ts");
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
      URL,
      Request,
      Response,
      Buffer,
      require: (id: string) => {
        if (id === "@/lib/auth") return { auth: async () => state.session };
        if (id === "@/lib/prisma") {
          return {
            prisma: {
              galleryMedia: {
                findFirst: async (args: Record<string, unknown>) => {
                  state.queries.push(args);
                  return state.media;
                },
              },
              user: {
                findUnique: async () => state.adminUser,
              },
            },
          };
        }
        if (id === "@/lib/upload") return { UPLOAD_DIR: "/tmp/media-test-uploads" };
        if (id === "fs/promises") {
          return {
            readFile: async () => {
              if (state.fileMissing) throw new Error("ENOENT");
              return Buffer.from("file-bytes");
            },
          };
        }
        return nodeRequire(id);
      },
    },
    { filename },
  );

  return exports as RouteExports;
}

const get = (route: RouteExports, filename: string) =>
  route.GET(new Request(`http://localhost/api/media/${filename}`), {
    params: Promise.resolve({ path: [filename] }),
  });

const mediaRow = (overrides: Partial<MediaRow> = {}): MediaRow => ({
  status: "PENDING",
  uploadedByUserId: "user-1",
  album: { isPublished: true },
  uploader: { person: { branchId: "branch-A" } },
  ...overrides,
});

describe("Secure media serving", () => {
  test("guest requesting PENDING media is forbidden", async () => {
    const state = fixture();
    state.media = mediaRow({ status: "PENDING" });
    assert.equal((await get(loadRoute(state), "pending.jpg")).status, 403);
  });

  test("guest requesting APPROVED media in a published album is served publicly", async () => {
    const state = fixture();
    state.media = mediaRow({ status: "APPROVED", album: { isPublished: true } });
    const response = await get(loadRoute(state), "approved.jpg");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "public, max-age=86400");
  });

  test("guest requesting REJECTED media is forbidden", async () => {
    const state = fixture();
    state.media = mediaRow({ status: "REJECTED" });
    assert.equal((await get(loadRoute(state), "rejected.jpg")).status, 403);
  });

  test("guest requesting APPROVED media in an unpublished album is forbidden", async () => {
    const state = fixture();
    state.media = mediaRow({ status: "APPROVED", album: { isPublished: false } });
    assert.equal((await get(loadRoute(state), "unpublished.jpg")).status, 403);
  });

  test("another member requesting PENDING media is forbidden", async () => {
    const state = fixture();
    state.session = { user: { id: "user-2", role: "MEMBER" } };
    state.media = mediaRow({ status: "PENDING", uploadedByUserId: "user-1" });
    assert.equal((await get(loadRoute(state), "pending.jpg")).status, 403);
  });

  test("uploader requesting their own PENDING media is served with a private cache", async () => {
    const state = fixture();
    state.session = { user: { id: "user-1", role: "MEMBER" } };
    state.media = mediaRow({ status: "PENDING", uploadedByUserId: "user-1" });
    const response = await get(loadRoute(state), "pending.jpg");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "private, max-age=3600");
  });

  test("SUPER_ADMIN requesting PENDING media is served with a private cache", async () => {
    const state = fixture();
    state.session = { user: { id: "admin-1", role: "SUPER_ADMIN" } };
    state.media = mediaRow({ status: "PENDING", uploadedByUserId: "user-1" });
    const response = await get(loadRoute(state), "pending.jpg");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "private, max-age=3600");
  });

  test("BRANCH_ADMIN requesting PENDING media is served", async () => {
    const state = fixture();
    state.session = { user: { id: "admin-2", role: "BRANCH_ADMIN" } };
    state.adminUser = { branchAdminOf: { id: "branch-A" } };
    state.media = mediaRow({ status: "PENDING", uploadedByUserId: "user-1", uploader: { person: { branchId: "branch-A" } } });
    assert.equal((await get(loadRoute(state), "pending.jpg")).status, 200);
  });

  test("BRANCH_ADMIN from branch A cannot access PENDING media from branch B", async () => {
    const state = fixture();
    state.session = { user: { id: "admin-A", role: "BRANCH_ADMIN" } };
    state.adminUser = { branchAdminOf: { id: "branch-A" } };
    state.media = mediaRow({ status: "PENDING", uploadedByUserId: "user-B", uploader: { person: { branchId: "branch-B" } } });
    assert.equal((await get(loadRoute(state), "pending.jpg")).status, 403);
  });

  test("BRANCH_ADMIN can still access published APPROVED media from another branch publicly", async () => {
    const state = fixture();
    state.session = { user: { id: "admin-A", role: "BRANCH_ADMIN" } };
    state.adminUser = { branchAdminOf: { id: "branch-A" } };
    state.media = mediaRow({ status: "APPROVED", album: { isPublished: true }, uploader: { person: { branchId: "branch-B" } } });
    const response = await get(loadRoute(state), "approved.jpg");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "public, max-age=86400");
  });

  test("BRANCH_ADMIN cannot access PENDING media without uploader branch", async () => {
    const state = fixture();
    state.session = { user: { id: "admin-A", role: "BRANCH_ADMIN" } };
    state.adminUser = { branchAdminOf: { id: "branch-A" } };
    state.media = mediaRow({ status: "PENDING", uploadedByUserId: "legacy-user", uploader: { person: { branchId: null } } });
    assert.equal((await get(loadRoute(state), "pending.jpg")).status, 403);
  });

  test("BRANCH_ADMIN from branch A can access REJECTED media from their branch", async () => {
    const state = fixture();
    state.session = { user: { id: "admin-A", role: "BRANCH_ADMIN" } };
    state.adminUser = { branchAdminOf: { id: "branch-A" } };
    state.media = mediaRow({ status: "REJECTED", uploadedByUserId: "user-1", uploader: { person: { branchId: "branch-A" } } });
    const response = await get(loadRoute(state), "rejected.jpg");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "private, max-age=3600");
  });

  test("BRANCH_ADMIN from branch A cannot access REJECTED media from branch B", async () => {
    const state = fixture();
    state.session = { user: { id: "admin-A", role: "BRANCH_ADMIN" } };
    state.adminUser = { branchAdminOf: { id: "branch-A" } };
    state.media = mediaRow({ status: "REJECTED", uploadedByUserId: "user-B", uploader: { person: { branchId: "branch-B" } } });
    assert.equal((await get(loadRoute(state), "rejected.jpg")).status, 403);
  });

  test("member requesting REJECTED media is forbidden even when they uploaded it", async () => {
    const state = fixture();
    state.session = { user: { id: "user-1", role: "MEMBER" } };
    state.media = mediaRow({ status: "REJECTED", uploadedByUserId: "user-1" });
    assert.equal((await get(loadRoute(state), "rejected.jpg")).status, 403);
  });

  test("admin requesting REJECTED media is served with a private cache", async () => {
    const state = fixture();
    state.session = { user: { id: "admin-1", role: "SUPER_ADMIN" } };
    state.media = mediaRow({ status: "REJECTED", uploadedByUserId: "user-1" });
    const response = await get(loadRoute(state), "rejected.jpg");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "private, max-age=3600");
  });

  test("admin previewing APPROVED media in an unpublished album is served privately", async () => {
    const state = fixture();
    state.session = { user: { id: "admin-1", role: "SUPER_ADMIN" } };
    state.media = mediaRow({ status: "APPROVED", album: { isPublished: false } });
    const response = await get(loadRoute(state), "unpublished.jpg");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "private, max-age=3600");
  });

  test("unknown filename without a gallery record is served with the legacy public cache", async () => {
    const state = fixture();
    const response = await get(loadRoute(state), "avatar.jpg");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "public, max-age=31536000, immutable");
  });

  test("the gallery lookup matches the filename suffix and loads album publication state", async () => {
    const state = fixture();
    state.media = mediaRow({ status: "APPROVED" });
    await get(loadRoute(state), "abc.jpg");
    assert.equal(state.queries.length, 1);
    // Objects created inside the VM realm are not reference-equal to literals
    // from this realm, so compare their serialized shape.
    assert.equal(
      JSON.stringify(state.queries[0].where),
      JSON.stringify({ url: { endsWith: "/abc.jpg" } }),
    );
    assert.equal(
      JSON.stringify(state.queries[0].include),
      JSON.stringify({
        album: { select: { isPublished: true } },
        uploader: { select: { person: { select: { branchId: true } } } },
      }),
    );
  });

  test("path traversal is rejected before any database lookup", async () => {
    const state = fixture();
    const route = loadRoute(state);
    const response = await route.GET(
      new Request("http://localhost/api/media/..%2Fetc%2Fpasswd"),
      { params: Promise.resolve({ path: ["..", "etc", "passwd"] }) },
    );
    assert.equal(response.status, 404);
    assert.equal(state.queries.length, 0);
  });

  test("unsupported extensions are rejected before any database lookup", async () => {
    const state = fixture();
    assert.equal((await get(loadRoute(state), "notes.txt")).status, 400);
    assert.equal(state.queries.length, 0);
  });

  test("missing file on disk returns 404 even for approved media", async () => {
    const state = fixture();
    state.media = mediaRow({ status: "APPROVED", album: { isPublished: true } });
    state.fileMissing = true;
    assert.equal((await get(loadRoute(state), "gone.jpg")).status, 404);
  });
});

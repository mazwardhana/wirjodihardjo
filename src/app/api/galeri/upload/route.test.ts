import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { describe, test } from "node:test";

type Row = Record<string, unknown>;

type Fixture = ReturnType<typeof fixture>;

function fixture() {
  const state = {
    session: { user: { id: "u1", role: "MEMBER" } } as
      | { user: { id: string; role: string } }
      | null,
    album: null as Row | null,
    admins: [{ id: "admin-1" }, { id: "admin-2" }] as Row[],
    media: [] as Row[],
    notifications: [] as Row[],
    audits: [] as Row[],
    files: [] as { path: string; size: number }[],
  };

  let mediaSequence = 0;
  let notificationSequence = 0;
  const prisma = {
    album: { findUnique: async () => state.album },
    galleryMedia: {
      create: async ({ data }: { data: Row }) => {
        const media = { id: `media-${++mediaSequence}`, ...data };
        state.media.push(media);
        return media;
      },
    },
    user: {
      findMany: async () => state.admins,
    },
    notification: {
      create: async ({ data }: { data: Row }) => {
        const notification = { id: `notification-${++notificationSequence}`, ...data };
        state.notifications.push(notification);
        return notification;
      },
    },
  };

  const fsMock = {
    mkdir: async () => undefined,
    writeFile: async (path: string, bytes: Buffer) => {
      state.files.push({ path, size: bytes.length });
    },
  };

  return { state, prisma, fsMock };
}

function loadRoute(f: Fixture) {
  const filename = resolve("src/app/api/galeri/upload/route.ts");
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
      URL,
      Request,
      Response,
      File,
      FormData,
      Blob,
      Buffer,
      process,
      require: (id: string) => {
        if (id === "@/lib/auth") return { auth: async () => f.state.session };
        if (id === "@/lib/prisma") return { prisma: f.prisma };
        if (id === "@/lib/audit") {
          return { logAudit: async (params: Row) => { f.state.audits.push(params); } };
        }
        if (id === "fs/promises") return f.fsMock;
        return nativeRequire(id);
      },
    },
    { filename },
  );

  return exports as { POST: (request: Request) => Promise<Response> };
}

const album = {
  id: "album-1",
  title: "Reuni 2026",
  slug: "reuni-2026",
  isPublished: true,
};

function formData(files: File[] = [new File(["image"], "foto.jpg", { type: "image/jpeg" })]) {
  const form = new FormData();
  form.append("albumId", "album-1");
  form.append("caption", "  Momen keluarga  ");
  for (const file of files) form.append("files[]", file);
  return form;
}

function request(body: FormData) {
  return new Request("http://localhost/api/galeri/upload", { method: "POST", body });
}

describe("POST /api/galeri/upload", () => {
  test("rejects a guest with 401", async () => {
    const f = fixture();
    f.state.session = null;
    const route = loadRoute(f);

    const response = await route.POST(request(formData()));

    assert.equal(response.status, 401);
    assert.equal(f.state.media.length, 0);
  });

  test("rejects a missing album with 404", async () => {
    const f = fixture();
    f.state.album = null;
    const route = loadRoute(f);

    const response = await route.POST(request(formData()));

    assert.equal(response.status, 404);
    assert.equal(f.state.media.length, 0);
  });

  test("rejects an unpublished album with 403", async () => {
    const f = fixture();
    f.state.album = { ...album, isPublished: false };
    const route = loadRoute(f);

    const response = await route.POST(request(formData()));

    assert.equal(response.status, 403);
    assert.equal(f.state.media.length, 0);
  });

  test("creates pending media and notifies admins for a valid upload", async () => {
    const f = fixture();
    f.state.album = album;
    const route = loadRoute(f);

    const response = await route.POST(request(formData()));
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.deepEqual(body.mediaIds, ["media-1"]);
    assert.equal(f.state.media[0].status, "PENDING");
    assert.equal(f.state.media[0].uploadedByUserId, "u1");
    assert.equal(f.state.media[0].caption, "Momen keluarga");
    assert.equal(f.state.notifications.length, 2);
    assert.equal(f.state.notifications[0].title, "Ada foto baru menunggu moderasi");
    assert.equal(f.state.notifications[0].body, "Ada foto baru menunggu moderasi di album Reuni 2026");
    assert.equal(f.state.notifications[0].link, "/admin/galeri/reuni-2026");
  });

  test("accepts multiple files and returns all media IDs", async () => {
    const f = fixture();
    f.state.album = album;
    const route = loadRoute(f);

    const response = await route.POST(
      request(formData([
        new File(["jpg"], "one.jpg", { type: "image/jpeg" }),
        new File(["png"], "two.png", { type: "image/png" }),
      ])),
    );
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.deepEqual(body.mediaIds, ["media-1", "media-2"]);
    assert.equal(f.state.files.length, 2);
    assert.equal(f.state.notifications.length, 2);
  });

  test("rejects unsupported types and files over 10MB", async () => {
    const unsupported = fixture();
    unsupported.state.album = album;
    const unsupportedRoute = loadRoute(unsupported);
    const unsupportedResponse = await unsupportedRoute.POST(
      request(formData([new File(["pdf"], "file.pdf", { type: "application/pdf" })])),
    );
    assert.equal(unsupportedResponse.status, 400);

    const oversized = fixture();
    oversized.state.album = album;
    const oversizedRoute = loadRoute(oversized);
    const oversizedResponse = await oversizedRoute.POST(
      request(formData([new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.jpg", { type: "image/jpeg" })])),
    );
    assert.equal(oversizedResponse.status, 400);
  });
});

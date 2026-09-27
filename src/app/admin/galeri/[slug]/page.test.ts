import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

type Row = Record<string, any>;

type State = {
  session: { user: { id: string } } | null;
  scope: { role: "SUPER_ADMIN" | "BRANCH_ADMIN"; branchId: string | null };
  album: Row | null;
};

function fixture(): State {
  return {
    session: null,
    scope: { role: "BRANCH_ADMIN", branchId: null },
    album: null,
  };
}

function loadPage(state: State) {
  const filename = resolve("src/app/admin/galeri/[slug]/page.tsx");
  const nativeRequire = createRequire(filename);
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;

  const exports: Record<string, unknown> = {};
  runInNewContext(
    output,
    {
      exports,
      module: { exports },
      require: (id: string) => {
        if (id === "@/lib/auth") return { auth: async () => state.session };
        if (id === "@/lib/rbac") return { requireAdminScope: async () => state.scope };
        if (id === "@/lib/prisma") {
          return { prisma: { album: { findUnique: async () => state.album } } };
        }
        if (id === "next/navigation") {
          return {
            redirect: (path: string) => {
              throw new Error(`REDIRECT:${path}`);
            },
            notFound: () => {
              throw new Error("NOT_FOUND");
            },
          };
        }
        if (id === "./AdminAlbumDetailClient") {
          return {
            AdminAlbumDetailClient: (props: Row) => ({ type: "detail", props }),
          };
        }
        if (id === "react/jsx-runtime") {
          return {
            jsx: (type: unknown, props: Row) => ({ type, props }),
            jsxs: (type: unknown, props: Row) => ({ type, props }),
            Fragment: "fragment",
          };
        }
        return nativeRequire(id);
      },
    },
    { filename },
  );

  return exports.default as (props: {
    params: Promise<{ slug: string }>;
  }) => Promise<Row>;
}

function media(id: string, uploaderBranchId: string | null): Row {
  return {
    id,
    url: `https://example.com/${id}.jpg`,
    thumbnailUrl: `https://example.com/${id}_thumb.jpg`,
    caption: `Media ${id}`,
    status: "APPROVED",
    rejectionReason: null,
    createdAt: new Date("2024-01-01"),
    uploader: uploaderBranchId
      ? { person: { fullName: "Uploader", branchId: uploaderBranchId } }
      : null,
  };
}

function detailProps(renderedPage: Row): Row {
  return renderedPage.props.children.props;
}

describe("/admin/galeri/[slug] branch scope", () => {
  test("BRANCH_ADMIN receives only media uploaded by people in their branch", async () => {
    const state = fixture();
    state.session = { user: { id: "admin-A" } };
    state.scope = { role: "BRANCH_ADMIN", branchId: "branch-A" };
    state.album = {
      id: "album-1",
      title: "Mixed Album",
      slug: "mixed",
      description: "Album with mixed media",
      eventDate: new Date("2024-01-01"),
      coverImageUrl: null,
      isPublished: true,
      createdAt: new Date("2024-01-01"),
      publishedAt: new Date("2024-01-01"),
      createdBy: { person: { fullName: "Creator" } },
      publishedBy: { person: { fullName: "Publisher" } },
      media: [
        media("own-1", "branch-A"),
        media("own-2", "branch-A"),
        media("other-1", "branch-B"),
        media("legacy", null),
      ],
    };

    const rendered = await loadPage(state)({ params: Promise.resolve({ slug: "mixed" }) });
    const props = detailProps(rendered);

    assert.deepEqual(
      props.media.map((m: Row) => m.id),
      ["own-1", "own-2"],
    );
    assert.equal(props.album.title, "Mixed Album");
  });

  test("SUPER_ADMIN receives all media regardless of branch", async () => {
    const state = fixture();
    state.session = { user: { id: "super" } };
    state.scope = { role: "SUPER_ADMIN", branchId: null };
    state.album = {
      id: "album-1",
      title: "Mixed Album",
      slug: "mixed",
      description: null,
      eventDate: null,
      coverImageUrl: null,
      isPublished: true,
      createdAt: new Date("2024-01-01"),
      publishedAt: null,
      createdBy: null,
      publishedBy: null,
      media: [
        media("own-1", "branch-A"),
        media("other-1", "branch-B"),
        media("legacy", null),
      ],
    };

    const rendered = await loadPage(state)({ params: Promise.resolve({ slug: "mixed" }) });

    assert.equal(detailProps(rendered).media.length, 3);
  });

  test("BRANCH_ADMIN receives no media when the album has no matching branch media", async () => {
    const state = fixture();
    state.session = { user: { id: "admin-A" } };
    state.scope = { role: "BRANCH_ADMIN", branchId: "branch-A" };
    state.album = {
      id: "album-1",
      title: "Other Branch Album",
      slug: "other",
      description: null,
      eventDate: null,
      coverImageUrl: null,
      isPublished: true,
      createdAt: new Date("2024-01-01"),
      publishedAt: null,
      createdBy: null,
      publishedBy: null,
      media: [media("other-1", "branch-B")],
    };

    const rendered = await loadPage(state)({ params: Promise.resolve({ slug: "other" }) });

    assert.equal(detailProps(rendered).media.length, 0);
  });
});

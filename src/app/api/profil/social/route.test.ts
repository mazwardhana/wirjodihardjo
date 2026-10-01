import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { crudTests, fixture, loadRoute, request, context, type Row } from "../../../../../tests/helpers/profile-route";

// Fixture untuk jalur baru (platform by name): get-or-create platform + upsert link.
function socialByNameFixture() {
  const f = fixture();
  const platforms: Row[] = [];
  const writes: Row[] = [];
  Object.assign(f.prisma, {
    socialPlatform: {
      findUnique: async () => f.state.platform,
      upsert: async (args: Row) => {
        const where = args.where as Row;
        const create = args.create as Row;
        const found = platforms.find((p) => p.name === where.name);
        if (found) return found;
        const platform = { id: `plat-${platforms.length + 1}`, name: where.name, baseUrl: create.baseUrl ?? null };
        platforms.push(platform);
        return platform;
      },
    },
    socialLink: {
      findFirst: async () => null,
      create: async (args: { data: Row }) => { writes.push(args.data); return { id: "l1", ...args.data }; },
      update: async (args: { data: Row }) => { writes.push(args.data); return { id: "l1", ...args.data }; },
    },
  });
  return { f, writes, platforms };
}

describe("SocialLink API", () => {
  crudTests("social",
    { platformId: "11111111-1111-4111-8111-111111111111", url: "https://github.com/user" },
    [
      { platformId: "not-uuid" },
      { url: "" },
      { url: "not-a-url" },
      { url: "a".repeat(501) },
      { username: "a".repeat(101) },
    ]
  );

  test("POST rejects non-existent platformId", async () => {
    const f = fixture(); f.state.platform = null;
    const route = loadRoute("src/app/api/profil/social/route.ts", f);
    const response = await route.POST(request("POST", {
      platformId: "11111111-1111-4111-8111-111111111111",
      url: "https://github.com/user",
    }), context());
    assert.equal(response.status, 400);
    assert.equal(f.state.writes.length, 0);
  });

  test("PUT rejects non-existent platformId", async () => {
    const f = fixture(); f.state.platform = null;
    const route = loadRoute("src/app/api/profil/social/[id]/route.ts", f);
    const response = await route.PUT(request("PUT", {
      platformId: "11111111-1111-4111-8111-111111111111",
    }), context());
    assert.equal(response.status, 400);
    assert.equal(f.state.writes.length, 0);
  });

  test("POST builds an Instagram URL from a bare username and creates the platform", async () => {
    const { f, writes, platforms } = socialByNameFixture();
    const route = loadRoute("src/app/api/profil/social/route.ts", f);
    const response = await route.POST(request("POST", { platform: "Instagram", url: "@budi_w" }));
    assert.equal(response.status, 201);
    assert.equal(platforms[0].name, "Instagram");
    assert.equal(writes[0].url, "https://instagram.com/budi_w");
    assert.equal(writes[0].username, "budi_w");
  });

  test("POST accepts a full TikTok URL and normalises it", async () => {
    const { f, writes } = socialByNameFixture();
    const route = loadRoute("src/app/api/profil/social/route.ts", f);
    const response = await route.POST(request("POST", { platform: "TikTok", url: "https://www.tiktok.com/@budi_w" }));
    assert.equal(response.status, 201);
    assert.equal(writes[0].url, "https://tiktok.com/@budi_w");
  });

  test("POST builds a LinkedIn URL under /in", async () => {
    const { f, writes } = socialByNameFixture();
    const route = loadRoute("src/app/api/profil/social/route.ts", f);
    const response = await route.POST(request("POST", { platform: "LinkedIn", url: "budi-w" }));
    assert.equal(response.status, 201);
    assert.equal(writes[0].url, "https://linkedin.com/in/budi-w");
  });

  test("POST rejects an unknown platform without a full URL", async () => {
    const { f, writes } = socialByNameFixture();
    const route = loadRoute("src/app/api/profil/social/route.ts", f);
    const response = await route.POST(request("POST", { platform: "Mastodon", url: "budi" }));
    assert.equal(response.status, 400);
    assert.equal(writes.length, 0);
  });

  test("POST menolak URL javascript: pada jalur platformId (400)", async () => {
    const f = fixture();
    const route = loadRoute("src/app/api/profil/social/route.ts", f);
    const response = await route.POST(request("POST", {
      platformId: "11111111-1111-4111-8111-111111111111",
      url: "javascript:alert(1)",
    }));
    assert.equal(response.status, 400);
    assert.equal(f.state.writes.length, 0);
  });

  test("POST menolak URL data: pada jalur platformId (400)", async () => {
    const f = fixture();
    const route = loadRoute("src/app/api/profil/social/route.ts", f);
    const response = await route.POST(request("POST", {
      platformId: "11111111-1111-4111-8111-111111111111",
      url: "data:text/html,<script>alert(1)</script>",
    }));
    assert.equal(response.status, 400);
    assert.equal(f.state.writes.length, 0);
  });

  test("POST keeps the legacy platformId path working", async () => {
    const { f } = socialByNameFixture();
    const route = loadRoute("src/app/api/profil/social/route.ts", f);
    const response = await route.POST(request("POST", {
      platformId: "11111111-1111-4111-8111-111111111111",
      url: "https://github.com/user",
    }));
    assert.equal(response.status, 201);
  });
});

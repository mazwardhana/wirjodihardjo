import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { crudTests, fixture, loadRoute, request, context } from "../../../../../tests/helpers/profile-route";

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
});

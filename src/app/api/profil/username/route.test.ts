import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { fixture, loadRoute, request, type Row } from "../../../../../tests/helpers/profile-route";

describe("Username API", () => {
  test("PUT requires authentication", async () => {
    const f = fixture();
    f.state.session = null;
    const route = loadRoute("src/app/api/profil/username/route.ts", f);
    const response = await route.PUT(request("PUT", { newUsername: "john_doe" }));
    assert.equal(response.status, 401);
    assert.equal(f.state.writes.length, 0);
  });

  test("PUT rejects username shorter than 3 chars", async () => {
    const f = fixture();
    const route = loadRoute("src/app/api/profil/username/route.ts", f);
    const response = await route.PUT(request("PUT", { newUsername: "ab" }));
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.ok(body.error.includes("Username"));
    assert.equal(f.state.writes.length, 0);
  });

  test("PUT rejects username longer than 30 chars", async () => {
    const f = fixture();
    const route = loadRoute("src/app/api/profil/username/route.ts", f);
    const response = await route.PUT(request("PUT", { newUsername: "a".repeat(31) }));
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.ok(body.error.includes("Username"));
    assert.equal(f.state.writes.length, 0);
  });

  test("PUT rejects username with invalid characters", async () => {
    const f = fixture();
    const route = loadRoute("src/app/api/profil/username/route.ts", f);
    const response = await route.PUT(request("PUT", { newUsername: "john@doe" }));
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.ok(body.error.includes("Username"));
    assert.equal(f.state.writes.length, 0);
  });

  test("PUT handles duplicate username gracefully", async () => {
    const f = fixture();
    f.state.user = { personId: "p1", id: "u1" };
    // Mock prisma to throw P2002 on user.update
    f.prisma.user.update = async () => {
      const error: any = new Error("Unique constraint failed");
      error.code = "P2002";
      throw error;
    };
    const route = loadRoute("src/app/api/profil/username/route.ts", f);
    const response = await route.PUT(request("PUT", { newUsername: "existing_user" }));
    assert.equal(response.status, 409);
    const body = await response.json();
    assert.ok(body.error.includes("sudah digunakan"));
  });

  test("PUT updates only username without touching mustChangeCredentials", async () => {
    const f = fixture();
    f.state.user = { personId: "p1", id: "u1" };
    const route = loadRoute("src/app/api/profil/username/route.ts", f);
    const response = await route.PUT(request("PUT", { newUsername: "new_username" }));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    
    // Verify user update
    const userUpdate = f.state.writes[0];
    assert.equal(userUpdate.username, "new_username");
    assert.equal(userUpdate.mustChangeCredentials, undefined); // Should not be set
    assert.equal(userUpdate.passwordHash, undefined); // Should not be set
    
    // Verify audit log
    const audit = f.state.writes[1];
    assert.equal((audit.data as Row).action, "UPDATE_USERNAME");
    assert.equal((audit.data as Row).actorUserId, "u1");
  });
});

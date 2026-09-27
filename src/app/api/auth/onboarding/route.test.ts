import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { fixture, loadRoute, request, type Row } from "../../../../../tests/helpers/profile-route";

describe("Onboarding API", () => {
  test("POST requires authentication", async () => {
    const f = fixture();
    f.state.session = null;
    const route = loadRoute("src/app/api/auth/onboarding/route.ts", f);
    const response = await route.POST(request("POST", {
      newUsername: "john_doe",
      newPassword: "password123",
      confirmPassword: "password123",
    }));
    assert.equal(response.status, 401);
    assert.equal(f.state.writes.length, 0);
  });

  test("POST requires mustChangeCredentials flag", async () => {
    const f = fixture();
    f.state.user = { personId: "p1", mustChangeCredentials: false };
    const route = loadRoute("src/app/api/auth/onboarding/route.ts", f);
    const response = await route.POST(request("POST", {
      newUsername: "john_doe",
      newPassword: "password123",
      confirmPassword: "password123",
    }));
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.error, "Tidak memerlukan perubahan kredensial");
    assert.equal(f.state.writes.length, 0);
  });

  test("POST rejects username shorter than 3 chars", async () => {
    const f = fixture();
    f.state.user = { personId: "p1", mustChangeCredentials: true };
    const route = loadRoute("src/app/api/auth/onboarding/route.ts", f);
    const response = await route.POST(request("POST", {
      newUsername: "ab",
      newPassword: "password123",
      confirmPassword: "password123",
    }));
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.ok(body.error.includes("Username"));
    assert.equal(f.state.writes.length, 0);
  });

  test("POST rejects username longer than 30 chars", async () => {
    const f = fixture();
    f.state.user = { personId: "p1", mustChangeCredentials: true };
    const route = loadRoute("src/app/api/auth/onboarding/route.ts", f);
    const response = await route.POST(request("POST", {
      newUsername: "a".repeat(31),
      newPassword: "password123",
      confirmPassword: "password123",
    }));
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.ok(body.error.includes("Username"));
    assert.equal(f.state.writes.length, 0);
  });

  test("POST rejects username with invalid characters", async () => {
    const f = fixture();
    f.state.user = { personId: "p1", mustChangeCredentials: true };
    const route = loadRoute("src/app/api/auth/onboarding/route.ts", f);
    const response = await route.POST(request("POST", {
      newUsername: "john@doe",
      newPassword: "password123",
      confirmPassword: "password123",
    }));
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.ok(body.error.includes("Username"));
    assert.equal(f.state.writes.length, 0);
  });

  test("POST rejects password shorter than 8 chars", async () => {
    const f = fixture();
    f.state.user = { personId: "p1", mustChangeCredentials: true };
    const route = loadRoute("src/app/api/auth/onboarding/route.ts", f);
    const response = await route.POST(request("POST", {
      newUsername: "john_doe",
      newPassword: "pass123",
      confirmPassword: "pass123",
    }));
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.ok(body.error.includes("sandi"));
    assert.equal(f.state.writes.length, 0);
  });

  test("POST rejects mismatched password confirmation", async () => {
    const f = fixture();
    f.state.user = { personId: "p1", mustChangeCredentials: true };
    const route = loadRoute("src/app/api/auth/onboarding/route.ts", f);
    const response = await route.POST(request("POST", {
      newUsername: "john_doe",
      newPassword: "password123",
      confirmPassword: "different123",
    }));
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.ok(body.error.includes("konfirmasi"));
    assert.equal(f.state.writes.length, 0);
  });

  test("POST handles duplicate username gracefully", async () => {
    const f = fixture();
    f.state.user = { personId: "p1", mustChangeCredentials: true };
    // Mock prisma to throw P2002 on user.update
    f.prisma.user.update = async () => {
      const error: any = new Error("Unique constraint failed");
      error.code = "P2002";
      throw error;
    };
    const route = loadRoute("src/app/api/auth/onboarding/route.ts", f);
    const response = await route.POST(request("POST", {
      newUsername: "existing_user",
      newPassword: "password123",
      confirmPassword: "password123",
    }));
    assert.equal(response.status, 409);
    const body = await response.json();
    assert.ok(body.error.includes("sudah digunakan"));
  });

  test("POST updates username, password, and clears flag", async () => {
    const f = fixture();
    f.state.user = { personId: "p1", id: "u1", mustChangeCredentials: true };
    const route = loadRoute("src/app/api/auth/onboarding/route.ts", f);
    const response = await route.POST(request("POST", {
      newUsername: "john_doe",
      newPassword: "password123",
      confirmPassword: "password123",
    }));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    
    // Verify user update
    const userUpdate = f.state.writes[0];
    assert.equal(userUpdate.username, "john_doe");
    assert.ok(userUpdate.passwordHash);
    assert.notEqual(userUpdate.passwordHash, "password123"); // Should be hashed
    assert.equal(userUpdate.mustChangeCredentials, false);
    
    // Verify audit log
    const audit = f.state.writes[1];
    assert.equal((audit.data as Row).action, "COMPLETE_ONBOARDING");
    assert.equal((audit.data as Row).actorUserId, "u1");
  });
});

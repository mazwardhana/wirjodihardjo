import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { fixture, loadRoute, request, type Row } from "../../../../../tests/helpers/profile-route";

describe("Onboarding API", () => {
  test("POST requires authentication", async () => {
    const f = fixture();
    f.state.session = null;
    const route = loadRoute("src/app/api/auth/onboarding/route.ts", f);
    const response = await route.POST(request("POST", {
      nickname: "andi",
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
      nickname: "andi",
      newPassword: "password123",
      confirmPassword: "password123",
    }));
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.error, "Tidak memerlukan perubahan kredensial");
    assert.equal(f.state.writes.length, 0);
  });

  test("POST rejects missing nickname", async () => {
    const f = fixture();
    f.state.user = { personId: "p1", mustChangeCredentials: true };
    const route = loadRoute("src/app/api/auth/onboarding/route.ts", f);
    const response = await route.POST(request("POST", {
      newPassword: "password123",
      confirmPassword: "password123",
    }));
    assert.equal(response.status, 400);
    assert.equal(f.state.writes.length, 0);
  });

  test("POST rejects nickname shorter than 2 chars", async () => {
    const f = fixture();
    f.state.user = { personId: "p1", mustChangeCredentials: true };
    const route = loadRoute("src/app/api/auth/onboarding/route.ts", f);
    const response = await route.POST(request("POST", {
      nickname: "a",
      newPassword: "password123",
      confirmPassword: "password123",
    }));
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.ok(body.error.includes("Nickname"));
    assert.equal(f.state.writes.length, 0);
  });

  test("POST rejects nickname longer than 50 chars", async () => {
    const f = fixture();
    f.state.user = { personId: "p1", mustChangeCredentials: true };
    const route = loadRoute("src/app/api/auth/onboarding/route.ts", f);
    const response = await route.POST(request("POST", {
      nickname: "a".repeat(51),
      newPassword: "password123",
      confirmPassword: "password123",
    }));
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.ok(body.error.includes("Nickname"));
    assert.equal(f.state.writes.length, 0);
  });

  test("POST accepts free-text nickname with spaces (no username regex)", async () => {
    const f = fixture();
    f.state.user = { personId: "p1", id: "u1", mustChangeCredentials: true };
    const route = loadRoute("src/app/api/auth/onboarding/route.ts", f);
    const response = await route.POST(request("POST", {
      nickname: "Budi Santoso",
      newPassword: "password123",
      confirmPassword: "password123",
    }));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    const personUpdate = f.state.writes[1];
    assert.equal(personUpdate.nickname, "Budi Santoso");
  });

  test("POST trims surrounding whitespace on nickname", async () => {
    const f = fixture();
    f.state.user = { personId: "p1", id: "u1", mustChangeCredentials: true };
    const route = loadRoute("src/app/api/auth/onboarding/route.ts", f);
    const response = await route.POST(request("POST", {
      nickname: "  Andi  ",
      newPassword: "password123",
      confirmPassword: "password123",
    }));
    assert.equal(response.status, 200);
    const personUpdate = f.state.writes[1];
    assert.equal(personUpdate.nickname, "Andi");
  });

  test("POST rejects password shorter than 8 chars", async () => {
    const f = fixture();
    f.state.user = { personId: "p1", mustChangeCredentials: true };
    const route = loadRoute("src/app/api/auth/onboarding/route.ts", f);
    const response = await route.POST(request("POST", {
      nickname: "andi",
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
      nickname: "andi",
      newPassword: "password123",
      confirmPassword: "different123",
    }));
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.ok(body.error.includes("konfirmasi"));
    assert.equal(f.state.writes.length, 0);
  });

  test("POST updates nickname, password, and clears flag", async () => {
    const f = fixture();
    f.state.user = { personId: "p1", id: "u1", mustChangeCredentials: true };
    const route = loadRoute("src/app/api/auth/onboarding/route.ts", f);
    const response = await route.POST(request("POST", {
      nickname: "andi",
      newPassword: "password123",
      confirmPassword: "password123",
    }));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    
    // Verify user update includes passwordHash and cleared flag
    const userUpdate = f.state.writes[0];
    assert.ok(userUpdate.passwordHash);
    assert.notEqual(userUpdate.passwordHash, "password123"); // Should be hashed
    assert.equal(userUpdate.mustChangeCredentials, false);
    assert.equal(userUpdate.username, undefined); // No username handling
    
    // Verify person nickname was updated
    const personUpdate = f.state.writes[1];
    assert.equal(personUpdate.nickname, "andi");
    
    // Verify audit log
    const audit = f.state.writes[2];
    assert.equal((audit.data as Row).action, "COMPLETE_ONBOARDING");
    assert.equal((audit.data as Row).actorUserId, "u1");
  });

  test("POST performs all onboarding writes inside one transaction", async () => {
    const f = fixture();
    f.state.user = { personId: "p1", id: "u1", mustChangeCredentials: true };

    // Fixture menambahkan $transaction lewat Object.assign sehingga tidak muncul
    // pada tipe hasil factory; dipetakan ulang di sini agar tetap terketik.
    const prisma = f.prisma as typeof f.prisma & {
      $transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
    };
    let txCalls = 0;
    const originalTx = prisma.$transaction;
    prisma.$transaction = async (fn) => {
      txCalls += 1;
      return originalTx(fn);
    };

    const route = loadRoute("src/app/api/auth/onboarding/route.ts", f);
    const response = await route.POST(request("POST", {
      nickname: "andi",
      newPassword: "password123",
      confirmPassword: "password123",
    }));
    assert.equal(response.status, 200);
    assert.equal(txCalls, 1);

    // Ketiga tulisan terekam di dalam transaksi tersebut.
    assert.equal(f.state.writes.length, 3);
    const userUpdate = f.state.writes[0];
    assert.ok(userUpdate.passwordHash);
    assert.equal(userUpdate.mustChangeCredentials, false);
    assert.equal(f.state.writes[1].nickname, "andi");
    assert.equal((f.state.writes[2].data as Row).action, "COMPLETE_ONBOARDING");
  });
});
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { fixture, loadRoute, request, type Row } from "../../../../../tests/helpers/profile-route";

describe("Profile Update API", () => {
  test("POST requires authentication", async () => {
    const f = fixture(); f.state.session = null;
    const route = loadRoute("src/app/api/profil/update/route.ts", f);
    assert.equal((await route.POST(request("POST", { occupation: "Engineer" }))).status, 401);
    assert.equal(f.state.writes.length, 0);
  });

  test("POST persists occupation and status to the Person record", async () => {
    const f = fixture(); const route = loadRoute("src/app/api/profil/update/route.ts", f);
    const response = await route.POST(request("POST", { occupation: "Engineer", status: "Active" }));
    assert.equal(response.status, 200);
    const personUpdate = f.state.writes[0];
    assert.equal(personUpdate.occupation, "Engineer");
    assert.equal(personUpdate.status, "Active");
  });

  test("POST rejects occupation over 200 chars", async () => {
    const f = fixture(); const route = loadRoute("src/app/api/profil/update/route.ts", f);
    assert.equal((await route.POST(request("POST", { occupation: "a".repeat(201) }))).status, 400);
    assert.equal(f.state.writes.length, 0);
  });

  test("POST rejects status over 500 chars", async () => {
    const f = fixture(); const route = loadRoute("src/app/api/profil/update/route.ts", f);
    assert.equal((await route.POST(request("POST", { status: "a".repeat(501) }))).status, 400);
    assert.equal(f.state.writes.length, 0);
  });

  test("POST keeps legacy fields working and audits the change", async () => {
    const f = fixture(); const route = loadRoute("src/app/api/profil/update/route.ts", f);
    const response = await route.POST(request("POST", { fullName: "A", bio: "B", phone: "123" }));
    assert.equal(response.status, 200);
    assert.equal(f.state.writes[0].fullName, "A");
    const audit = f.state.writes[f.state.writes.length - 1];
    assert.equal((audit.data as Row).action, "UPDATE_PROFILE");
    assert.equal((audit.data as Row).actorUserId, "u1");
  });
});

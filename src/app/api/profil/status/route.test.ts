import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { fixture, loadRoute, request, type Row } from "../../../../../tests/helpers/profile-route";

// PersonStatus belum ada di fixture bersama; tambahkan model tiruan yang
// mencatat query dan tulisan seperti pola socialByNameFixture.
function statusFixture() {
  const f = fixture();
  const rows: Row[] = [
    { id: "s2", message: "Kabar terbaru", createdAt: new Date("2026-09-02T00:00:00Z") },
    { id: "s1", message: "Kabar lama", createdAt: new Date("2026-09-01T00:00:00Z") },
  ];
  Object.assign(f.prisma, {
    personStatus: {
      findMany: async (args: Row) => { f.state.queries.push(args); return rows; },
      create: async (args: { data: Row }) => { f.state.writes.push(args.data); return { id: "s3", ...args.data }; },
    },
  });
  return f;
}

describe("PersonStatus API", () => {
  test("GET requires authentication", async () => {
    const f = statusFixture(); f.state.session = null;
    const route = loadRoute("src/app/api/profil/status/route.ts", f);
    assert.equal((await route.GET(request("GET"))).status, 401);
  });

  test("POST requires authentication without writes", async () => {
    const f = statusFixture(); f.state.session = null;
    const route = loadRoute("src/app/api/profil/status/route.ts", f);
    assert.equal((await route.POST(request("POST", { message: "Halo" }))).status, 401);
    assert.equal(f.state.writes.length, 0);
  });

  test("GET returns statuses newest first, limited to 20", async () => {
    const f = statusFixture();
    const route = loadRoute("src/app/api/profil/status/route.ts", f);
    const response = await route.GET(request("GET"));
    assert.equal(response.status, 200);
    const query = f.state.queries[0];
    assert.equal((query.where as Row).personId, "p1");
    assert.equal((query.orderBy as Row).createdAt, "desc");
    assert.equal(query.take, 20);
    const body = await response.json();
    assert.equal(body.statuses[0].message, "Kabar terbaru");
  });

  test("POST binds ownership to account and audits CREATE_STATUS", async () => {
    const f = statusFixture();
    const route = loadRoute("src/app/api/profil/status/route.ts", f);
    const response = await route.POST(request("POST", { message: "Kabar baru", personId: "p2" }));
    assert.equal(response.status, 201);
    assert.equal(f.state.writes[0].personId, "p1");
    assert.equal(f.state.writes[0].message, "Kabar baru");
    const audit = f.state.writes[1] as { data: Row };
    assert.equal(audit.data.action, "CREATE_STATUS");
    assert.equal(audit.data.actorUserId, "u1");
  });

  test("POST rejects an empty message", async () => {
    const f = statusFixture();
    const route = loadRoute("src/app/api/profil/status/route.ts", f);
    assert.equal((await route.POST(request("POST", { message: "   " }))).status, 400);
    assert.equal(f.state.writes.length, 0);
  });

  test("POST rejects a message over 500 chars", async () => {
    const f = statusFixture();
    const route = loadRoute("src/app/api/profil/status/route.ts", f);
    assert.equal((await route.POST(request("POST", { message: "a".repeat(501) }))).status, 400);
    assert.equal(f.state.writes.length, 0);
  });
});

import { describe } from "node:test";
import { governanceFixture, loadGovernanceRoute, request, json, assertNoWrites, test, assert } from "../../../../../../tests/helpers/governance-route";

describe("GovernancePosition API", () => {
  const routePath = "src/app/api/admin/governance/position/route.ts";

  test("GET requires authentication", async () => {
    const f = governanceFixture();
    f.state.session = null;
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.GET(new Request("http://localhost?structureId=s1"));
    assert.equal(response.status, 401);
  });

  test("GET requires structureId", async () => {
    const f = governanceFixture();
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.GET(new Request("http://localhost"));
    assert.equal(response.status, 400);
  });

  test("GET returns positions for structure", async () => {
    const f = governanceFixture();
    f.state.positions.push({ id: "pos-1", structureId: "s1", name: "Ketua" });
    f.state.positions.push({ id: "pos-2", structureId: "s2", name: "Sekretaris" });
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.GET(new Request("http://localhost?structureId=s1"));
    assert.equal(response.status, 200);
    const body = await json(response);
    assert.equal(body.length, 1);
  });

  test("POST rejects non-SUPER_ADMIN", async () => {
    const f = governanceFixture();
    f.state.session = { user: { id: "u2", role: "BRANCH_ADMIN" } };
    f.state.structures.push({ id: "s1", name: "Test" });
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.POST(request("POST", { structureId: "s1", name: "Ketua" }));
    assert.equal(response.status, 403);
    assertNoWrites(f);
  });

  test("POST requires structureId", async () => {
    const f = governanceFixture();
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.POST(request("POST", { name: "Ketua" }));
    assert.equal(response.status, 400);
    assertNoWrites(f);
  });

  test("POST requires name", async () => {
    const f = governanceFixture();
    f.state.structures.push({ id: "s1", name: "Test" });
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.POST(request("POST", { structureId: "s1" }));
    assert.equal(response.status, 400);
    assertNoWrites(f);
  });

  test("POST returns 404 for missing structure", async () => {
    const f = governanceFixture();
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.POST(request("POST", { structureId: "missing", name: "Ketua" }));
    assert.equal(response.status, 404);
    assertNoWrites(f);
  });

  test("POST returns 404 for missing parent position", async () => {
    const f = governanceFixture();
    f.state.structures.push({ id: "s1", name: "Test" });
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.POST(request("POST", {
      structureId: "s1",
      name: "Wakil",
      parentPositionId: "missing",
    }));
    assert.equal(response.status, 404);
    assertNoWrites(f);
  });

  test("POST rejects parent from another structure", async () => {
    const f = governanceFixture();
    f.state.structures.push({ id: "s1", name: "Structure 1" });
    f.state.structures.push({ id: "s2", name: "Structure 2" });
    f.state.positions.push({ id: "pos-1", structureId: "s2", name: "Ketua" });
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.POST(request("POST", {
      structureId: "s1",
      name: "Wakil",
      parentPositionId: "pos-1",
    }));
    assert.equal(response.status, 400);
    assertNoWrites(f);
  });

  test("POST creates position with defaults and audits", async () => {
    const f = governanceFixture();
    f.state.structures.push({ id: "s1", name: "Test" });
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.POST(request("POST", {
      structureId: "s1",
      name: "Ketua",
      capacity: 1,
    }));
    assert.equal(response.status, 201);
    const body = await json(response);
    assert.equal(body.name, "Ketua");
    assert.equal(f.state.writes.length, 1);
    assert.equal(f.state.audits.length, 1);
    assert.equal(f.state.audits[0].action, "GOVERNANCE_POSITION_CREATE");
  });

  test("PUT rejects non-SUPER_ADMIN", async () => {
    const f = governanceFixture();
    f.state.session = { user: { id: "u2", role: "BRANCH_ADMIN" } };
    f.state.positions.push({ id: "pos-1", structureId: "s1", name: "Ketua" });
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.PUT(request("PUT", { id: "pos-1", name: "Updated" }));
    assert.equal(response.status, 403);
    assertNoWrites(f);
  });

  test("PUT returns 404 for missing position", async () => {
    const f = governanceFixture();
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.PUT(request("PUT", { id: "missing", name: "Updated" }));
    assert.equal(response.status, 404);
    assertNoWrites(f);
  });

  test("PUT rejects non-positive capacity", async () => {
    const f = governanceFixture();
    f.state.positions.push({ id: "pos-1", structureId: "s1", name: "Ketua" });
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.PUT(request("PUT", { id: "pos-1", capacity: -1 }));
    assert.equal(response.status, 400);
    assertNoWrites(f);
  });

  test("PUT rejects self as parent", async () => {
    const f = governanceFixture();
    f.state.positions.push({ id: "pos-1", structureId: "s1", name: "Ketua" });
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.PUT(request("PUT", { id: "pos-1", parentPositionId: "pos-1" }));
    assert.equal(response.status, 400);
    assertNoWrites(f);
  });

  test("PUT updates position and audits", async () => {
    const f = governanceFixture();
    f.state.positions.push({ id: "pos-1", structureId: "s1", name: "Ketua", capacity: 1 });
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.PUT(request("PUT", { id: "pos-1", name: "Ketua Umum", capacity: 2 }));
    assert.equal(response.status, 200);
    assert.equal(f.state.writes.length, 1);
    assert.equal(f.state.audits.length, 1);
    assert.equal(f.state.audits[0].action, "GOVERNANCE_POSITION_UPDATE");
  });

  test("DELETE rejects non-SUPER_ADMIN", async () => {
    const f = governanceFixture();
    f.state.session = { user: { id: "u2", role: "BRANCH_ADMIN" } };
    f.state.positions.push({ id: "pos-1", structureId: "s1", name: "Ketua", _count: { childPositions: 0 } });
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.DELETE(new Request("http://localhost?id=pos-1", { method: "DELETE" }));
    assert.equal(response.status, 403);
    assertNoWrites(f);
  });

  test("DELETE returns 404 for missing position", async () => {
    const f = governanceFixture();
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.DELETE(new Request("http://localhost?id=missing", { method: "DELETE" }));
    assert.equal(response.status, 404);
    assertNoWrites(f);
  });

  test("DELETE rejects position with child positions", async () => {
    const f = governanceFixture();
    f.state.positions.push({ id: "pos-1", structureId: "s1", name: "Ketua", _count: { childPositions: 2 } });
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.DELETE(new Request("http://localhost?id=pos-1", { method: "DELETE" }));
    assert.equal(response.status, 400);
    assertNoWrites(f);
  });

  test("DELETE removes position and audits", async () => {
    const f = governanceFixture();
    f.state.positions.push({ id: "pos-1", structureId: "s1", name: "Ketua", _count: { childPositions: 0 } });
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.DELETE(new Request("http://localhost?id=pos-1", { method: "DELETE" }));
    assert.equal(response.status, 200);
    assert.equal(f.state.writes.length, 1);
    assert.equal(f.state.audits.length, 1);
    assert.equal(f.state.audits[0].action, "GOVERNANCE_POSITION_DELETE");
  });
});

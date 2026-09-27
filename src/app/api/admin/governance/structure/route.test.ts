import { describe } from "node:test";
import { governanceFixture, loadGovernanceRoute, request, json, assertNoWrites, test, assert } from "../../../../../../tests/helpers/governance-route";

describe("GovernanceStructure API", () => {
  const routePath = "src/app/api/admin/governance/structure/route.ts";

  test("GET rejects unauthenticated requests", async () => {
    const f = governanceFixture();
    f.state.session = null;
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.GET(request("GET"));
    assert.equal(response.status, 401);
  });

  test("GET rejects MEMBER role", async () => {
    const f = governanceFixture();
    f.state.session = { user: { id: "u3", role: "MEMBER" } };
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.GET(request("GET"));
    assert.equal(response.status, 403);
  });

  test("GET allows SUPER_ADMIN", async () => {
    const f = governanceFixture();
    f.state.session = { user: { id: "u1", role: "SUPER_ADMIN" } };
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.GET(request("GET"));
    assert.equal(response.status, 200);
  });

  test("GET allows BRANCH_ADMIN", async () => {
    const f = governanceFixture();
    f.state.session = { user: { id: "u2", role: "BRANCH_ADMIN" } };
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.GET(request("GET"));
    assert.equal(response.status, 200);
  });

  test("POST rejects non-SUPER_ADMIN", async () => {
    const f = governanceFixture();
    f.state.session = { user: { id: "u2", role: "BRANCH_ADMIN" } };
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.POST(request("POST", { name: "Test", startDate: "2024-01-01" }));
    assert.equal(response.status, 403);
    assertNoWrites(f);
  });

  test("POST requires name", async () => {
    const f = governanceFixture();
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.POST(request("POST", { startDate: "2024-01-01" }));
    assert.equal(response.status, 400);
    assertNoWrites(f);
  });

  test("POST requires startDate", async () => {
    const f = governanceFixture();
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.POST(request("POST", { name: "Kepengurusan 2024" }));
    assert.equal(response.status, 400);
    assertNoWrites(f);
  });

  test("POST rejects invalid startDate", async () => {
    const f = governanceFixture();
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.POST(request("POST", { name: "Test", startDate: "invalid" }));
    assert.equal(response.status, 400);
    assertNoWrites(f);
  });

  test("POST rejects endDate before startDate", async () => {
    const f = governanceFixture();
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.POST(request("POST", {
      name: "Test",
      startDate: "2024-06-01",
      endDate: "2024-01-01",
    }));
    assert.equal(response.status, 400);
    assertNoWrites(f);
  });

  test("POST rejects duplicate name", async () => {
    const f = governanceFixture();
    f.state.structures.push({ id: "s1", name: "Existing Structure" });
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.POST(request("POST", {
      name: "Existing Structure",
      startDate: "2024-01-01",
    }));
    assert.equal(response.status, 409);
    assert.equal(f.state.writes.length, 0);
  });

  test("POST creates valid structure and audits", async () => {
    const f = governanceFixture();
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.POST(request("POST", {
      name: "Kepengurusan 2024-2026",
      description: "Masa bakti 2024-2026",
      startDate: "2024-01-01",
      endDate: "2026-12-31",
      isActive: true,
    }));
    assert.equal(response.status, 201);
    const body = await json(response);
    assert.equal(body.name, "Kepengurusan 2024-2026");
    assert.equal(f.state.writes.length, 1);
    assert.equal(f.state.audits.length, 1);
    assert.equal(f.state.audits[0].action, "GOVERNANCE_STRUCTURE_CREATE");
  });

  test("PUT rejects non-SUPER_ADMIN", async () => {
    const f = governanceFixture();
    f.state.session = { user: { id: "u2", role: "BRANCH_ADMIN" } };
    f.state.structures.push({ id: "s1", name: "Test" });
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.PUT(request("PUT", { id: "s1", name: "Updated" }));
    assert.equal(response.status, 403);
    assertNoWrites(f);
  });

  test("PUT requires id", async () => {
    const f = governanceFixture();
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.PUT(request("PUT", { name: "Updated" }));
    assert.equal(response.status, 400);
    assertNoWrites(f);
  });

  test("PUT returns 404 for missing structure", async () => {
    const f = governanceFixture();
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.PUT(request("PUT", { id: "missing", name: "Updated" }));
    assert.equal(response.status, 404);
    assertNoWrites(f);
  });

  test("PUT rejects duplicate name", async () => {
    const f = governanceFixture();
    f.state.structures.push({ id: "s1", name: "Structure 1" });
    f.state.structures.push({ id: "s2", name: "Structure 2" });
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.PUT(request("PUT", { id: "s1", name: "Structure 2" }));
    assert.equal(response.status, 409);
    assert.equal(f.state.writes.length, 0);
  });

  test("PUT updates structure and audits", async () => {
    const f = governanceFixture();
    f.state.structures.push({
      id: "s1",
      name: "Original",
      startDate: new Date("2024-01-01"),
      isActive: true,
    });
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.PUT(request("PUT", {
      id: "s1",
      name: "Updated Name",
      isActive: false,
    }));
    assert.equal(response.status, 200);
    assert.equal(f.state.writes.length, 1);
    assert.equal(f.state.audits.length, 1);
    assert.equal(f.state.audits[0].action, "GOVERNANCE_STRUCTURE_UPDATE");
  });

  test("DELETE rejects non-SUPER_ADMIN", async () => {
    const f = governanceFixture();
    f.state.session = { user: { id: "u2", role: "BRANCH_ADMIN" } };
    f.state.structures.push({ id: "s1", name: "Test" });
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.DELETE(new Request("http://localhost?id=s1", { method: "DELETE" }));
    assert.equal(response.status, 403);
    assertNoWrites(f);
  });

  test("DELETE returns 404 for missing structure", async () => {
    const f = governanceFixture();
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.DELETE(new Request("http://localhost?id=missing", { method: "DELETE" }));
    assert.equal(response.status, 404);
    assertNoWrites(f);
  });

  test("DELETE deactivates structure and audits", async () => {
    const f = governanceFixture();
    f.state.structures.push({ id: "s1", name: "Test", isActive: true });
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.DELETE(new Request("http://localhost?id=s1", { method: "DELETE" }));
    assert.equal(response.status, 200);
    assert.equal(f.state.writes.length, 1);
    assert.equal(f.state.audits.length, 1);
    assert.equal(f.state.audits[0].action, "GOVERNANCE_STRUCTURE_DEACTIVATE");
  });
});

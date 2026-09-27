import { describe } from "node:test";
import { governanceFixture, loadGovernanceRoute, request, json, assertNoWrites, test, assert } from "../../../../../../tests/helpers/governance-route";

describe("GovernanceAssignment API", () => {
  const routePath = "src/app/api/admin/governance/assignment/route.ts";
  const valid = {
    positionId: "pos-1",
    personId: "p1",
    startDate: "2024-01-01",
  };

  function seedPosition(f: ReturnType<typeof governanceFixture>, extra: Record<string, unknown> = {}) {
    f.state.positions.push({
      id: "pos-1",
      structureId: "s1",
      name: "Ketua",
      capacity: null,
      isBranchRepresentative: false,
      ...extra,
    });
  }

  test("GET requires authentication", async () => {
    const f = governanceFixture();
    f.state.session = null;
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.GET(new Request("http://localhost?positionId=pos-1"));
    assert.equal(response.status, 401);
  });

  test("GET requires admin scope", async () => {
    const f = governanceFixture();
    f.state.session = { user: { id: "u3", role: "MEMBER" } };
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.GET(new Request("http://localhost?positionId=pos-1"));
    assert.equal(response.status, 403);
  });

  test("POST rejects unauthenticated requests", async () => {
    const f = governanceFixture();
    f.state.session = null;
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.POST(request("POST", valid));
    assert.equal(response.status, 401);
    assertNoWrites(f);
  });

  test("POST rejects BRANCH_ADMIN for global assignments", async () => {
    const f = governanceFixture();
    f.state.session = { user: { id: "u2", role: "BRANCH_ADMIN" } };
    seedPosition(f);
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.POST(request("POST", valid));
    assert.equal(response.status, 403);
    assertNoWrites(f);
  });

  test("POST returns 404 for missing position", async () => {
    const f = governanceFixture();
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.POST(request("POST", valid));
    assert.equal(response.status, 404);
    assertNoWrites(f);
  });

  test("POST returns 404 for missing person", async () => {
    const f = governanceFixture();
    seedPosition(f);
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.POST(request("POST", { ...valid, personId: "missing" }));
    assert.equal(response.status, 404);
    assertNoWrites(f);
  });

  test("POST rejects deleted person", async () => {
    const f = governanceFixture();
    f.state.persons.p1.deletedAt = new Date("2024-01-01");
    seedPosition(f);
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.POST(request("POST", valid));
    assert.equal(response.status, 400);
    assertNoWrites(f);
  });

  test("POST rejects duplicate assignment", async () => {
    const f = governanceFixture();
    seedPosition(f);
    f.state.assignments.push({ id: "a1", positionId: "pos-1", personId: "p1" });
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.POST(request("POST", valid));
    assert.equal(response.status, 409);
    assertNoWrites(f);
  });

  test("POST enforces global position capacity", async () => {
    const f = governanceFixture();
    seedPosition(f, { capacity: 1 });
    f.state.assignments.push({ id: "a1", positionId: "pos-1", personId: "p2" });
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.POST(request("POST", valid));
    assert.equal(response.status, 409);
    assertNoWrites(f);
  });

  test("POST requires branchId for representative positions", async () => {
    const f = governanceFixture();
    seedPosition(f, { isBranchRepresentative: true });
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.POST(request("POST", valid));
    assert.equal(response.status, 400);
    assertNoWrites(f);
  });

  test("POST rejects representative from another branch", async () => {
    const f = governanceFixture();
    seedPosition(f, { isBranchRepresentative: true });
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.POST(request("POST", { ...valid, branchId: "b2" }));
    assert.equal(response.status, 400);
    assertNoWrites(f);
  });

  test("POST enforces two representative slots per branch", async () => {
    const f = governanceFixture();
    seedPosition(f, { isBranchRepresentative: true });
    f.state.persons.p3 = { id: "p3", fullName: "Person Three", branchId: "b1", deletedAt: null };
    f.state.persons.p4 = { id: "p4", fullName: "Person Four", branchId: "b1", deletedAt: null };
    f.state.persons.p5 = { id: "p5", fullName: "Person Five", branchId: "b1", deletedAt: null };
    f.state.assignments.push(
      { id: "a1", positionId: "pos-1", personId: "p3", branchId: "b1" },
      { id: "a2", positionId: "pos-1", personId: "p4", branchId: "b1" },
    );
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.POST(request("POST", { ...valid, personId: "p5", branchId: "b1" }));
    assert.equal(response.status, 409);
    assertNoWrites(f);
  });

  test("POST allows same representative position in another branch", async () => {
    const f = governanceFixture();
    seedPosition(f, { isBranchRepresentative: true });
    f.state.persons.p3 = { id: "p3", fullName: "Person Three", branchId: "b2", deletedAt: null };
    f.state.persons.p4 = { id: "p4", fullName: "Person Four", branchId: "b2", deletedAt: null };
    f.state.assignments.push(
      { id: "a1", positionId: "pos-1", personId: "p3", branchId: "b2" },
      { id: "a2", positionId: "pos-1", personId: "p4", branchId: "b2" },
    );
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.POST(request("POST", { ...valid, personId: "p2", branchId: "b2" }));
    assert.equal(response.status, 409);
  });

  test("POST creates valid assignment and audits", async () => {
    const f = governanceFixture();
    seedPosition(f);
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.POST(request("POST", valid));
    assert.equal(response.status, 201);
    const body = await json(response);
    assert.equal(body.personId, "p1");
    assert.equal(f.state.writes.length, 1);
    assert.equal(f.state.audits.length, 1);
    assert.equal(f.state.audits[0].action, "GOVERNANCE_ASSIGNMENT_CREATE");
  });

  test("DELETE rejects BRANCH_ADMIN", async () => {
    const f = governanceFixture();
    f.state.session = { user: { id: "u2", role: "BRANCH_ADMIN" } };
    f.state.assignments.push({ id: "a1", positionId: "pos-1", personId: "p1" });
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.DELETE(new Request("http://localhost?id=a1", { method: "DELETE" }));
    assert.equal(response.status, 403);
    assertNoWrites(f);
  });

  test("DELETE returns 404 for missing assignment", async () => {
    const f = governanceFixture();
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.DELETE(new Request("http://localhost?id=missing", { method: "DELETE" }));
    assert.equal(response.status, 404);
    assertNoWrites(f);
  });

  test("DELETE removes assignment and audits", async () => {
    const f = governanceFixture();
    f.state.assignments.push({ id: "a1", positionId: "pos-1", personId: "p1" });
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.DELETE(new Request("http://localhost?id=a1", { method: "DELETE" }));
    assert.equal(response.status, 200);
    assert.equal(f.state.writes.length, 1);
    assert.equal(f.state.audits.length, 1);
    assert.equal(f.state.audits[0].action, "GOVERNANCE_ASSIGNMENT_DELETE");
  });
});

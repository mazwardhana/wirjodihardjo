import { describe } from "node:test";
import { governanceFixture, loadGovernanceRoute, request, json, assertNoWrites, test, assert } from "../../../../../../tests/helpers/governance-route";

describe("BranchRepresentative API", () => {
  const routePath = "src/app/api/admin/governance/branch-representative/route.ts";
  const valid = {
    branchId: "b1",
    personId: "p1",
    slot: 1,
    startDate: "2024-01-01",
  };

  test("GET requires authentication", async () => {
    const f = governanceFixture();
    f.state.session = null;
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.GET(new Request("http://localhost?branchId=b1"));
    assert.equal(response.status, 401);
  });

  test("GET requires an admin scope", async () => {
    const f = governanceFixture();
    f.state.session = { user: { id: "u3", role: "MEMBER" } };
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.GET(new Request("http://localhost?branchId=b1"));
    assert.equal(response.status, 403);
  });

  test("POST allows BRANCH_ADMIN to assign own branch", async () => {
    const f = governanceFixture();
    f.state.session = { user: { id: "u2", role: "BRANCH_ADMIN" } };
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.POST(request("POST", valid));
    assert.equal(response.status, 201);
    const body = await json(response);
    assert.equal(body.branchId, "b1");
    assert.equal(f.state.writes.length, 1);
    assert.equal(f.state.audits[0].action, "BRANCH_REPRESENTATIVE_CREATE");
  });

  test("POST rejects BRANCH_ADMIN assigning another branch", async () => {
    const f = governanceFixture();
    f.state.session = { user: { id: "u2", role: "BRANCH_ADMIN" } };
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.POST(request("POST", { ...valid, branchId: "b2", personId: "p2" }));
    assert.equal(response.status, 403);
    assertNoWrites(f);
  });

  test("POST rejects person from another branch", async () => {
    const f = governanceFixture();
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.POST(request("POST", { ...valid, personId: "p2" }));
    assert.equal(response.status, 400);
    assertNoWrites(f);
  });

  test("POST validates slot range", async () => {
    const f = governanceFixture();
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.POST(request("POST", { ...valid, slot: 3 }));
    assert.equal(response.status, 400);
    assertNoWrites(f);
  });

  test("POST rejects occupied slot atomically", async () => {
    const f = governanceFixture();
    f.state.representatives.push({ id: "rep-1", branchId: "b1", personId: "p2", slot: 1 });
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.POST(request("POST", valid));
    assert.equal(response.status, 409);
    assertNoWrites(f);
  });

  test("POST allows the second slot", async () => {
    const f = governanceFixture();
    f.state.representatives.push({ id: "rep-1", branchId: "b1", personId: "p1", slot: 1 });
    f.state.persons.p3 = { id: "p3", fullName: "Person Three", branchId: "b1", deletedAt: null };
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.POST(request("POST", { ...valid, personId: "p3", slot: 2 }));
    assert.equal(response.status, 201);
  });

  test("DELETE rejects BRANCH_ADMIN deleting another branch", async () => {
    const f = governanceFixture();
    f.state.session = { user: { id: "u2", role: "BRANCH_ADMIN" } };
    f.state.representatives.push({ id: "rep-1", branchId: "b2", personId: "p2", slot: 1 });
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.DELETE(new Request("http://localhost?id=rep-1", { method: "DELETE" }));
    assert.equal(response.status, 403);
    assertNoWrites(f);
  });

  test("DELETE removes own branch representative", async () => {
    const f = governanceFixture();
    f.state.session = { user: { id: "u2", role: "BRANCH_ADMIN" } };
    f.state.representatives.push({ id: "rep-1", branchId: "b1", personId: "p1", slot: 1 });
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.DELETE(new Request("http://localhost?id=rep-1", { method: "DELETE" }));
    assert.equal(response.status, 200);
    assert.equal(f.state.writes.length, 1);
    assert.equal(f.state.audits[0].action, "BRANCH_REPRESENTATIVE_DELETE");
  });
});

import { describe } from "node:test";
import {
  governanceFixture,
  loadGovernanceRoute,
  request,
  json,
  assertNoWrites,
  test,
  assert,
} from "../../../../../../tests/helpers/governance-route";
import { DEFAULT_POSITIONS } from "@/lib/governance-admin";

describe("GovernanceSetup API", () => {
  const routePath = "src/app/api/admin/governance/setup/route.ts";

  test("POST rejects unauthenticated requests", async () => {
    const f = governanceFixture();
    f.state.session = null;
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.POST(request("POST", {}));
    // Mengikuti konvensi handler POST governance lain: requireSuperAdmin
    // menyatukan sesi kosong dan peran salah menjadi 403.
    assert.equal(response.status, 403);
    assertNoWrites(f);
  });

  test("POST rejects non-SUPER_ADMIN", async () => {
    const f = governanceFixture();
    f.state.session = { user: { id: "u2", role: "BRANCH_ADMIN" } };
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.POST(request("POST", {}));
    assert.equal(response.status, 403);
    assertNoWrites(f);
  });

  test("POST membuat struktur + seluruh jabatan bawaan sekali jalan", async () => {
    const f = governanceFixture();
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.POST(request("POST", {}));
    assert.equal(response.status, 201);

    const body = await json(response);
    assert.ok(body.structureId, "structureId dikembalikan");
    assert.equal(f.state.structures.length, 1);
    assert.equal(f.state.positions.length, DEFAULT_POSITIONS.length);
    assert.equal(f.state.positions[0].name, "Dewan Pertimbangan");
    assert.ok(
      f.state.positions.some((p) => p.name === "Bidang Kreatif dan Kepemudaan"),
      "bidang terakhir ikut dibuat",
    );
    assert.equal(
      f.state.audits.filter((a) => a.action === "GOVERNANCE_STRUCTURE_CREATE").length,
      1,
    );
  });

  test("POST menolak bila sudah ada struktur aktif", async () => {
    const f = governanceFixture();
    f.state.structures.push({ id: "s1", name: "Kepengurusan Lama", isActive: true });
    const route = loadGovernanceRoute(routePath, f);
    const response = await route.POST(request("POST", {}));
    assert.equal(response.status, 409);
    assertNoWrites(f);
  });
});

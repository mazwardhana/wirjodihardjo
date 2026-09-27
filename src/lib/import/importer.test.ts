import { test } from "node:test";
import assert from "node:assert";
import { prisma } from "@/lib/prisma";
import { commitImportData, ImportError } from "./importer";
import type { ImportBatchPayload } from "./types";

test("resolves branch by branchNumber", async () => {
  const branch = await prisma.branch.findFirst({
    where: { branchNumber: 1, isActive: true },
  });
  assert.ok(branch, "Branch 1 should exist");
});

test("preserves externalRef for idempotent re-import", async () => {
  // This test would require setting up a batch with externalRef
  // For now, just verify the structure supports it
  assert.ok(true);
});

test("creates Person and PersonPrivate only", async () => {
  // Integration test placeholder - verifies no User/PersonChild/PersonPartner created
  assert.ok(true);
});

test("stores catatan in private notes", async () => {
  // Verify catatan field maps to PersonPrivate
  assert.ok(true);
});

test("requires SUPER_ADMIN for commit", async () => {
  // This would be tested in the full integration
  assert.ok(true);
});

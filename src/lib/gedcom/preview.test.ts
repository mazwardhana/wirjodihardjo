import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildGedcomPreview } from "./preview";
import type { GedcomParseResult, GedcomPlan } from "./types";

function data(count: number): GedcomParseResult {
  return {
    charSet: "UTF-8",
    persons: Array.from({ length: count }, (_, i) => ({
      gedcomId: `@I${i + 1}@`,
      fullName: `Orang ${i + 1}`,
      gender: "MALE" as const,
      birthDate: null,
      birthDateRaw: undefined,
      deathDate: null,
      isDeceased: false,
    })),
    families: [],
  };
}

function previewPlan(createdIds: string[], total: number): GedcomPlan {
  return {
    personsCreated: createdIds.length,
    personsSkipped: 0,
    childEdgesCreated: 0,
    partnerEdgesCreated: 0,
    errors: [],
    warnings: [],
    persons: Array.from({ length: total }, (_, i) => {
      const gedcomId = `@I${i + 1}@`;
      const willCreate = createdIds.includes(gedcomId);
      return {
        gedcomId,
        fullName: `Orang ${i + 1}`,
        gender: "MALE" as const,
        willCreate,
        reason: willCreate ? undefined : "sudah ada, dilewati",
      };
    }),
  };
}

describe("buildGedcomPreview", () => {
  test("menghasilkan satu baris per orang", () => {
    const rows = buildGedcomPreview(data(5), previewPlan(["@I1@", "@I2@", "@I3@", "@I4@", "@I5@"], 5));
    assert.strictEqual(rows.length, 5);
  });

  test("status baru untuk yang akan dibuat", () => {
    const rows = buildGedcomPreview(data(3), previewPlan(["@I1@", "@I2@"], 3));
    assert.strictEqual(rows[0].status, "baru");
    assert.strictEqual(rows[1].status, "baru");
  });

  test("status dilewati untuk yang duplikat", () => {
    const rows = buildGedcomPreview(data(3), previewPlan(["@I1@"], 3));
    assert.strictEqual(rows[0].status, "baru");
    assert.strictEqual(rows[1].status, "dilewati");
    assert.strictEqual(rows[1].reason, "sudah ada, dilewati");
  });

  test("menghormati batas limit", () => {
    const rows = buildGedcomPreview(data(250), previewPlan(["@I1@"], 250), 100);
    assert.strictEqual(rows.length, 100);
  });
});
import assert from "node:assert/strict";
import test from "node:test";
import { auditLogQuery } from "./query";

test("combines search, action, entity and inclusive end date", () => {
  const result = auditLogQuery({ q: "  keluarga ", action: "LOGIN", entityType: "User", dateTo: "2026-09-27" });
  assert.equal(result.where.action, "LOGIN");
  assert.equal(result.where.entityType, "User");
  assert.ok(Array.isArray(result.where.OR));
  assert.ok(JSON.stringify(result.where.OR).includes('"contains":"keluarga"'));
  assert.deepEqual(result.where.createdAt, { lt: new Date("2026-09-28T00:00:00.000Z") });
});

test("invalid calendar dates and non-ISO dates are dropped", () => {
  const result = auditLogQuery({ dateFrom: "bad", dateTo: "2026-02-30" });
  assert.equal(result.where.createdAt, undefined);
});

test("repeated parameters use the first value instead of an array", () => {
  const result = auditLogQuery({ q: ["keluarga", "lain"] });
  assert.equal(typeof (result.where.OR as Array<unknown>)[0], "object");
  assert.ok(JSON.stringify(result.where.OR).includes('"contains":"keluarga"'));
  assert.ok(!JSON.stringify(result.where.OR).includes("lain"));
});

test("unsafe pagination falls back to safe defaults", () => {
  const result = auditLogQuery({ limit: "-1", page: "Infinity" });
  assert.equal(result.limit, 50);
  assert.equal(result.page, 1);
  assert.equal(result.offset, 0);
});

test("valid page size and page are retained", () => {
  const result = auditLogQuery({ limit: "25", page: "3" });
  assert.equal(result.limit, 25);
  assert.equal(result.page, 3);
  assert.equal(result.offset, 50);
});

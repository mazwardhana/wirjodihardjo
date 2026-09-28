import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveBaseUsername, deriveUniqueUsername, slugifyUsername } from "./username";

test("slugify: lowercase, non-alphanumeric becomes underscore, trims excess underscores", () => {
  assert.equal(slugifyUsername("  Budi Santoso  "), "budi_santoso");
  assert.equal(slugifyUsername("Rina O'Brien"), "rina_o_brien");
  assert.equal(slugifyUsername("___   a   b___"), "a_b");
  assert.equal(slugifyUsername("!!!"), "");
});

test("slugify caps at 24 characters", () => {
  const value = slugifyUsername("a".repeat(50));
  assert.equal(value.length, 24);
});

test("deriveBase: uses nickname when long enough", () => {
  assert.equal(deriveBaseUsername("Budi", "Budi Santoso"), "budi");
  assert.equal(deriveBaseUsername("  ", "Budi Santoso"), "budi_santoso");
});

test("deriveBase: falls back to full name and pads short values", () => {
  assert.equal(deriveBaseUsername("!!", "Ib"), "ib_x");
  assert.equal(deriveBaseUsername("", ""), "_x_x");
  assert.equal(deriveBaseUsername("a", "a"), "a_x");
});

test("deriveUnique: returns base when free, then -2, -3 suffixes", () => {
  const taken = new Set<string>();
  const first = deriveUniqueUsername("budi", "Budi Santoso", taken);
  assert.equal(first, "budi");
  taken.add(first);
  assert.equal(deriveUniqueUsername("budi", "Budi Santoso", taken), "budi-2");
  taken.add("budi-2");
  assert.equal(deriveUniqueUsername("budi", "Budi Santoso", taken), "budi-3");
});

test("deriveUnique: suffix keeps total length within 30 chars", () => {
  const long = "x".repeat(24);
  const taken = new Set<string>([long, `${long}-2`]);
  const result = deriveUniqueUsername(long, long, taken);
  assert.ok(result.startsWith("x"));
  assert.ok(result.length <= 30, `got ${result.length}: ${result}`);
  assert.notEqual(result, long);
});

test("deriveUnique: full name with spaces becomes a single username", () => {
  const taken = new Set<string>();
  const first = deriveUniqueUsername("  Budi  Santoso ", "Budi Santoso", taken);
  assert.equal(first, "budi_santoso");
  taken.add(first);
  const second = deriveUniqueUsername("  Budi  Santoso ", "Budi Santoso", taken);
  assert.equal(second, "budi_santoso-2");
});

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { analyzeGedcom } from "./analyze";
import type { GedcomParseResult, GedcomValidationResult } from "./types";

type PersonRow = { id: string; externalRef: string | null; fullName: string; birthDate: Date | null };
type FindManyArgs = { where?: Record<string, unknown>; select?: Record<string, unknown> };

function makeDb() {
  const personCalls: FindManyArgs[] = [];
  let rows: PersonRow[] = [];
  const db = {
    person: {
      async findMany(args: FindManyArgs) {
        personCalls.push(args);
        return rows;
      },
    },
  };
  return { db, personCalls, setRows: (r: PersonRow[]) => { rows = r; } };
}

function person(overrides: Partial<GedcomParseResult["persons"][number]> = {}) {
  return {
    gedcomId: "@I1@",
    fullName: "Budi Santoso",
    gender: "MALE" as const,
    birthDate: new Date(Date.UTC(1980, 0, 12)),
    birthDateRaw: undefined,
    deathDate: null,
    isDeceased: false,
    ...overrides,
  };
}

function validation(overrides: Partial<GedcomValidationResult> = {}): GedcomValidationResult {
  return {
    valid: true,
    errors: [],
    warnings: [],
    data: { charSet: "UTF-8", persons: [], families: [] },
    ...overrides,
  };
}

describe("analyzeGedcom", () => {
  test("orang baru -> akan dibuat, tanpa skip", async () => {
    const { db, setRows } = makeDb();
    setRows([]);
    const data: GedcomParseResult = {
      charSet: "UTF-8",
      persons: [person()],
      families: [],
    };
    const plan = await analyzeGedcom(db, data, validation());
    assert.strictEqual(plan.personsCreated, 1);
    assert.strictEqual(plan.personsSkipped, 0);
    assert.strictEqual(plan.persons[0].willCreate, true);
  });

  test("duplikat via externalRef sama -> dilewati", async () => {
    const { db, setRows } = makeDb();
    setRows([{ id: "p1", externalRef: "@I1@", fullName: "Budi Santoso", birthDate: new Date(Date.UTC(1980, 0, 12)) }]);
    const data: GedcomParseResult = {
      charSet: "UTF-8",
      persons: [person()],
      families: [],
    };
    const plan = await analyzeGedcom(db, data, validation());
    assert.strictEqual(plan.personsCreated, 0);
    assert.strictEqual(plan.personsSkipped, 1);
    assert.strictEqual(plan.persons[0].willCreate, false);
    assert.strictEqual(plan.persons[0].reason, "sudah ada, dilewati");
  });

  test("duplikat via nama+tanggal -> dilewati", async () => {
    const { db, setRows } = makeDb();
    setRows([{ id: "p1", externalRef: null, fullName: "Budi Santoso", birthDate: new Date(Date.UTC(1980, 0, 12)) }]);
    const data: GedcomParseResult = {
      charSet: "UTF-8",
      persons: [person()],
      families: [],
    };
    const plan = await analyzeGedcom(db, data, validation());
    assert.strictEqual(plan.personsCreated, 0);
    assert.strictEqual(plan.personsSkipped, 1);
  });

  test("gedcomId duplikat dalam file -> skip dengan reason file", async () => {
    const { db, setRows } = makeDb();
    setRows([]);
    const data: GedcomParseResult = {
      charSet: "UTF-8",
      persons: [person(), person()],
      families: [],
    };
    const plan = await analyzeGedcom(db, data, validation());
    assert.strictEqual(plan.personsCreated, 1);
    assert.strictEqual(plan.personsSkipped, 1);
    assert.strictEqual(plan.persons[1].reason, "duplikat @I1@ di file");
  });

  test("hitung edge anak & pasangan yang direncanakan", async () => {
    const { db, setRows } = makeDb();
    setRows([]);
    const data: GedcomParseResult = {
      charSet: "UTF-8",
      persons: [
        person({ gedcomId: "@I1@", fullName: "Budi Santoso" }),
        person({ gedcomId: "@I2@", fullName: "Siti Rahayu", gender: "FEMALE" }),
        person({ gedcomId: "@I3@", fullName: "Anak", gender: "FEMALE" }),
      ],
      families: [
        { gedcomId: "@F1@", husband: "@I1@", wife: "@I2@", children: ["@I3@"], marriageDate: null, divorceDate: null, status: "MARRIED" },
      ],
    };
    const plan = await analyzeGedcom(db, data, validation());
    assert.strictEqual(plan.personsCreated, 3);
    assert.strictEqual(plan.childEdgesCreated, 2); // ayah->anak, ibu->anak
    assert.strictEqual(plan.partnerEdgesCreated, 1);
  });

  test("error validasi diteruskan ke plan", async () => {
    const { db, setRows } = makeDb();
    setRows([]);
    const data: GedcomParseResult = {
      charSet: "UTF-8",
      persons: [],
      families: [],
    };
    const plan = await analyzeGedcom(db, data, validation({
      valid: false,
      errors: [{ record: "INDI", field: "INDI", message: "File GEDCOM tidak memuat orang (INDI)." }],
    }));
    assert.strictEqual(plan.errors.length, 1);
    assert.strictEqual(plan.personsCreated, 0);
  });
});
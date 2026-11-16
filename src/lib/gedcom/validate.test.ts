import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { validateGedcom } from "./validate";
import type { GedcomParseResult } from "./types";

function base(): GedcomParseResult {
  return {
    charSet: "UTF-8",
    persons: [
      {
        gedcomId: "@I1@",
        fullName: "Budi Santoso",
        gender: "MALE",
        birthDate: new Date(Date.UTC(1980, 0, 12)),
        birthPlace: "Yogyakarta",
        deathDate: null,
        deathPlace: undefined,
        isDeceased: false,
      },
      {
        gedcomId: "@I2@",
        fullName: "Siti Rahayu",
        gender: "FEMALE",
        birthDate: null,
        deathDate: null,
        isDeceased: false,
      },
    ],
    families: [
      {
        gedcomId: "@F1@",
        husband: "@I1@",
        wife: "@I2@",
        children: [],
        marriageDate: null,
        divorceDate: null,
        status: "MARRIED",
      },
    ],
  };
}

describe("validateGedcom", () => {
  test("data valid -> valid true, tanpa error", () => {
    const result = validateGedcom(base());
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
  });

  test("tanpa INDI -> error", () => {
    const data = base();
    data.persons = [];
    const result = validateGedcom(data);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((e) => e.message.includes("INDI")));
  });

  test("nama kosong -> error NAME", () => {
    const data = base();
    data.persons[0].fullName = "   ";
    const result = validateGedcom(data);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((e) => e.field === "NAME" && e.record === "@I1@"));
  });

  test("nama terlalu panjang -> error NAME", () => {
    const data = base();
    data.persons[0].fullName = "x".repeat(201);
    const result = validateGedcom(data);
    assert.ok(result.errors.some((e) => e.field === "NAME"));
  });

  test("referensi HUSB/WIFE yang tidak ada -> error ghost", () => {
    const data = base();
    data.families[0].husband = "@I999@";
    const result = validateGedcom(data);
    assert.ok(result.errors.some((e) => e.field === "HUSB/WIFE" && e.message.includes("@I999@")));
  });

  test("HUSB == WIFE -> error", () => {
    const data = base();
    data.families[0].wife = "@I1@";
    const result = validateGedcom(data);
    assert.ok(result.errors.some((e) => e.message.includes("tidak boleh sama")));
  });

  test("anak tidak ada -> error CHIL", () => {
    const data = base();
    data.families[0].children = ["@I777@"];
    const result = validateGedcom(data);
    assert.ok(result.errors.some((e) => e.field === "CHIL"));
  });

  test("anak adalah orang tua juga -> error CHIL", () => {
    const data = base();
    data.families[0].children = ["@I1@"];
    const result = validateGedcom(data);
    assert.ok(result.errors.some((e) => e.field === "CHIL" && e.message.includes("anak dan orang tua")));
  });

  test("anak muncul dua kali -> warning (bukan error)", () => {
    const data = base();
    data.persons.push({
      gedcomId: "@I3@",
      fullName: "Anak",
      gender: "OTHER",
      birthDate: null,
      deathDate: null,
      isDeceased: false,
    });
    data.families[0].children = ["@I3@", "@I3@"];
    const result = validateGedcom(data);
    assert.strictEqual(result.valid, true);
    assert.ok(result.warnings.some((w) => w.includes("dua kali")));
  });

  test("warning parser diteruskan", () => {
    const data = base();
    data.warnings = ["SEX 'X' tidak dikenal"];
    const result = validateGedcom(data);
    assert.ok(result.warnings.some((w) => w.includes("SEX")));
  });

  test("tanggal lahir mentah tanpa parse -> warning", () => {
    const data = base();
    data.persons[0].birthDateRaw = "HARI INI";
    data.persons[0].birthDate = null;
    const result = validateGedcom(data);
    assert.ok(result.warnings.some((w) => w.includes("lahir")));
  });
});
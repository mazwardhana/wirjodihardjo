import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { serializeGedcom, type GedcomExportPerson } from "./export";
import { parseGedcom } from "./parser";

function person(overrides: Partial<GedcomExportPerson> = {}): GedcomExportPerson {
  return {
    id: "p1",
    externalRef: null,
    fullName: "Budi Santoso",
    gender: "MALE",
    birthDate: new Date(Date.UTC(1980, 0, 12)),
    birthPlace: "Yogyakarta",
    deathDate: null,
    deathPlace: null,
    isDeceased: false,
    occupation: "Petani",
    notes: "Catatan pertama\nbaris kedua",
    parents: [],
    children: [],
    partners: [],
    ...overrides,
  };
}

describe("serializeGedcom", () => {
  test("memiliki HEAD/TRLR dan versi 5.5.1", () => {
    const ged = serializeGedcom([person()]);
    assert.ok(ged.startsWith("0 HEAD\n"));
    assert.ok(ged.includes("0 TRLR"));
    assert.ok(ged.includes("2 VERS 5.5.1"));
    assert.ok(ged.includes("2 FORM LINEAGE-LINKED"));
  });

  test("serialisasi INDI lengkap: nama, gender, BIRT, DEAT, OCCU, NOTE", () => {
    const ged = serializeGedcom([
      person({
        id: "p1",
        fullName: "Budi Santoso",
        gender: "MALE",
        birthDate: new Date(Date.UTC(1980, 0, 12)),
        birthPlace: "Yogyakarta",
        isDeceased: true,
        deathDate: new Date(Date.UTC(2020, 4, 5)),
        deathPlace: "Jakarta",
        occupation: "Petani",
        notes: "Catatan pertama\nbaris kedua",
      }),
    ]);
    assert.ok(ged.includes("1 NAME Budi /Santoso/"));
    assert.ok(ged.includes("2 GIVN Budi"));
    assert.ok(ged.includes("2 SURN Santoso"));
    assert.ok(ged.includes("1 SEX M"));
    assert.ok(ged.includes("1 BIRT"));
    assert.ok(ged.includes("2 DATE 12 JAN 1980"));
    assert.ok(ged.includes("2 PLAC Yogyakarta"));
    assert.ok(ged.includes("1 DEAT"));
    assert.ok(ged.includes("2 DATE 05 MAY 2020"));
    assert.ok(ged.includes("2 PLAC Jakarta"));
    assert.ok(ged.includes("1 OCCU Petani"));
    assert.ok(ged.includes("1 NOTE Catatan pertama"));
    assert.ok(ged.includes("1 CONT baris kedua"));
  });

  test("gender FEMALE -> SEX F, OTHER -> SEX U", () => {
    const ged = serializeGedcom([
      person({ id: "p2", fullName: "Siti Rahayu", gender: "FEMALE" }),
      person({ id: "p3", fullName: "Anonim", gender: "OTHER" }),
    ]);
    assert.ok(ged.includes("1 SEX F"));
    assert.ok(ged.includes("1 SEX U"));
  });

  test("FAM dibuat dari relasi pasangan + anak", () => {
    // Prisma mengembalikan setiap edge PersonChild dari KEDUA sisi: orang tua
    // melihatnya di `children`, anak melihatnya di `parents`. Fixture harus
    // mencerminkan itu, sama seperti query di route ekspor.
    const ged = serializeGedcom([
      person({
        id: "p1",
        fullName: "Budi Santoso",
        gender: "MALE",
        children: [{ childId: "p3" }],
        partners: [{ partnerId: "p2", status: "MARRIED", marriageDate: new Date(Date.UTC(2004, 5, 15)), divorceDate: null }],
      }),
      person({ id: "p2", fullName: "Siti Rahayu", gender: "FEMALE", children: [{ childId: "p3" }] }),
      person({
        id: "p3",
        fullName: "Anak",
        gender: "FEMALE",
        parents: [{ parentId: "p1", parentGender: "MALE" }, { parentId: "p2", parentGender: "FEMALE" }],
      }),
    ]);
    assert.ok(ged.includes("0 @F1@ FAM"));
    assert.ok(ged.includes("1 HUSB @I1@"));
    assert.ok(ged.includes("1 WIFE @I2@"));
    assert.ok(ged.includes("1 CHIL @I3@"));
    assert.ok(ged.includes("1 MARR"));
    assert.ok(ged.includes("2 DATE 15 JUN 2004"));
  });

  test("round-trip: export -> import menghasilkan orang & keluarga yang sama", () => {
    const input = [
      person({
        id: "p1",
        fullName: "Budi Santoso",
        gender: "MALE",
        children: [{ childId: "p3" }],
        partners: [{ partnerId: "p2", status: "MARRIED", marriageDate: new Date(Date.UTC(2004, 5, 15)), divorceDate: null }],
      }),
      person({ id: "p2", fullName: "Siti Rahayu", gender: "FEMALE", children: [{ childId: "p3" }] }),
      person({
        id: "p3",
        fullName: "Anak",
        gender: "FEMALE",
        parents: [{ parentId: "p1", parentGender: "MALE" }, { parentId: "p2", parentGender: "FEMALE" }],
      }),
    ];
    const ged = serializeGedcom(input);
    const parsed = parseGedcom(Buffer.from(ged, "utf-8"));
    assert.strictEqual(parsed.persons.length, 3);
    assert.strictEqual(parsed.families.length, 1);
    assert.strictEqual(parsed.families[0].husband, "@I1@");
    assert.strictEqual(parsed.families[0].wife, "@I2@");
    assert.deepStrictEqual(parsed.families[0].children, ["@I3@"]);
    assert.strictEqual(parsed.families[0].status, "MARRIED");
    assert.strictEqual(parsed.families[0].marriageDate!.getUTCFullYear(), 2004);
  });

  test("nilai kosong tidak memunculkan baris kosong", () => {
    const ged = serializeGedcom([person({ birthPlace: null, deathPlace: null, occupation: null, notes: null, nickname: null })]);
    assert.ok(!ged.includes("1 BIRT\n1 "));
    assert.ok(ged.includes("1 BIRT"));
  });
});
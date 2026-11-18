import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  parseGedcom,
  parseGedcomDate,
} from "./parser";
import { MAX_GEDCOM_BYTES } from "./types";

const SAMPLE = `0 HEAD
1 SOUR TestSuite
1 GEDC
2 VERS 5.5.1
2 FORM LINEAGE-LINKED
1 CHAR UTF-8
0 @I1@ INDI
1 NAME Budi /Santoso/
2 GIVN Budi
2 SURN Santoso
1 SEX M
1 BIRT
2 DATE 12 JAN 1980
2 PLAC Yogyakarta
1 OCCU Petani
1 NOTE Baris pertama
2 CONT baris kedua
0 @I2@ INDI
1 NAME Siti /Rahayu/
2 GIVN Siti
2 SURN Rahayu
1 SEX F
1 DEAT
2 DATE 5 MAY 2020
0 @I3@ INDI
1 NAME Linda /Santoso/
2 GIVN Linda
2 SURN Santoso
1 SEX F
1 BIRT
2 DATE 2005
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 CHIL @I3@
1 MARR
2 DATE 15 JUN 2004
0 TRLR
`;

function buffer(text = SAMPLE): Buffer {
  return Buffer.from(text, "utf-8");
}

describe("parseGedcomDate", () => {
  test("D MMM YYYY", () => {
    const d = parseGedcomDate("12 JAN 1980");
    assert.ok(d);
    assert.strictEqual(d!.getUTCFullYear(), 1980);
    assert.strictEqual(d!.getUTCMonth(), 0);
    assert.strictEqual(d!.getUTCDate(), 12);
  });

  test("MMM YYYY -> hari 1", () => {
    const d = parseGedcomDate("JUN 2004");
    assert.ok(d);
    assert.strictEqual(d!.getUTCFullYear(), 2004);
    assert.strictEqual(d!.getUTCMonth(), 5);
    assert.strictEqual(d!.getUTCDate(), 1);
  });

  test("YYYY -> 1 Jan", () => {
    const d = parseGedcomDate("2005");
    assert.ok(d);
    assert.strictEqual(d!.getUTCFullYear(), 2005);
    assert.strictEqual(d!.getUTCMonth(), 0);
    assert.strictEqual(d!.getUTCDate(), 1);
  });

  test("ABT/EST/CAL qualifier -> tahun pertama wajar", () => {
    assert.strictEqual(parseGedcomDate("ABT 1910")!.getUTCFullYear(), 1910);
    assert.strictEqual(parseGedcomDate("EST 1905")!.getUTCFullYear(), 1905);
    assert.strictEqual(parseGedcomDate("CAL 8 SEP 1950")!.getUTCFullYear(), 1950);
  });

  test("BET..AND.. -> ambil tanggal pertama", () => {
    const d = parseGedcomDate("BET 1900 AND 1910");
    assert.ok(d);
    assert.strictEqual(d!.getUTCFullYear(), 1900);
  });

  test("AFT/BEF/FROM/TO -> ambil tahun", () => {
    assert.strictEqual(parseGedcomDate("AFT 1800")!.getUTCFullYear(), 1800);
    assert.strictEqual(parseGedcomDate("BEF 1850")!.getUTCFullYear(), 1850);
    assert.strictEqual(parseGedcomDate("FROM 1920")!.getUTCFullYear(), 1920);
  });

  test("empty/undefined -> null", () => {
    assert.strictEqual(parseGedcomDate(""), null);
    assert.strictEqual(parseGedcomDate(undefined), null);
  });

  test("invalid tanggal -> null", () => {
    assert.strictEqual(parseGedcomDate("ABC DEF GHIJ"), null);
    assert.strictEqual(parseGedcomDate("31 FEB 2000"), null); // tanggal mustahil
    assert.strictEqual(parseGedcomDate("0 JAN 1900"), null);
  });
});

describe("parseGedcom", () => {
  test("membaca orang dan keluarga", () => {
    const result = parseGedcom(buffer());
    assert.strictEqual(result.persons.length, 3);
    assert.strictEqual(result.families.length, 1);
    assert.strictEqual(result.charSet, "UTF-8");
    assert.strictEqual(result.sourceName, "TestSuite");
    assert.strictEqual(result.warnings, undefined);
  });

  test("detail INDI: nama, gender, tanggal, tempat, pekerjaan, catatan", () => {
    const result = parseGedcom(buffer());
    const budi = result.persons[0];
    assert.strictEqual(budi.gedcomId, "@I1@");
    assert.strictEqual(budi.fullName, "Budi Santoso");
    assert.strictEqual(budi.givenName, "Budi");
    assert.strictEqual(budi.surname, "Santoso");
    assert.strictEqual(budi.gender, "MALE");
    assert.strictEqual(budi.birthDateRaw, "12 JAN 1980");
    assert.strictEqual(budi.birthDate!.getUTCFullYear(), 1980);
    assert.strictEqual(budi.birthPlace, "Yogyakarta");
    assert.strictEqual(budi.isDeceased, false);
    assert.strictEqual(budi.occupation, "Petani");
    assert.strictEqual(budi.notes, "Baris pertama\nbaris kedua");
  });

  test("detail INDI wafat: isDeceased + death date/place", () => {
    const result = parseGedcom(buffer());
    const siti = result.persons[1];
    assert.strictEqual(siti.gender, "FEMALE");
    assert.strictEqual(siti.isDeceased, true);
    assert.strictEqual(siti.deathDate!.getUTCFullYear(), 2020);
    assert.strictEqual(siti.deathDate!.getUTCMonth(), 4); // MAY
    assert.strictEqual(siti.deathDate!.getUTCDate(), 5);
  });

  test("FAM: husband/wife/children + status pernikahan", () => {
    const result = parseGedcom(buffer());
    const fam = result.families[0];
    assert.strictEqual(fam.gedcomId, "@F1@");
    assert.strictEqual(fam.husband, "@I1@");
    assert.strictEqual(fam.wife, "@I2@");
    assert.deepStrictEqual(fam.children, ["@I3@"]);
    assert.strictEqual(fam.status, "MARRIED");
    assert.strictEqual(fam.marriageDate!.getUTCFullYear(), 2004);
  });

  test("tahun-saja BIRT -> tanggal jadi 1 Jan", () => {
    const result = parseGedcom(buffer());
    const linda = result.persons[2];
    assert.strictEqual(linda.birthDate!.getUTCFullYear(), 2005);
    assert.strictEqual(linda.birthDate!.getUTCMonth(), 0);
    assert.strictEqual(linda.birthDate!.getUTCDate(), 1);
  });

  test("SEX tidak dikenal -> gender OTHER + warning", () => {
    const ged = SAMPLE.replace("1 SEX M\n", "1 SEX X\n").replace("1 SEX F\n", "1 SEX  \n");
    const result = parseGedcom(buffer(ged));
    assert.strictEqual(result.persons[0].gender, "OTHER");
    assert.ok(result.warnings?.some((w) => w.includes("SEX")));
  });

  test("tanpa GIVN/SURN -> pakai NAMA apa adanya", () => {
    const ged = `0 HEAD
1 CHAR UTF-8
0 @I1@ INDI
1 NAME Budi Santoso
1 SEX M
0 TRLR
`;
    const result = parseGedcom(buffer(ged));
    assert.strictEqual(result.persons.length, 1);
    assert.strictEqual(result.persons[0].fullName, "Budi Santoso");
  });

  test("catatan non-INDI/FAM dilewati tanpa error", () => {
    const ged = `0 HEAD
1 CHAR UTF-8
0 @S1@ SUBM
1 NAME Test
0 @N1@ NOTE
1 CONT Catatan global
0 @I1@ INDI
1 NAME Budi /Santoso/
0 TRLR
`;
    const result = parseGedcom(buffer(ged));
    assert.strictEqual(result.persons.length, 1);
    assert.strictEqual(result.families.length, 0);
  });

  test("struktur: harus diawali 0 HEAD", () => {
    const ged = SAMPLE.replace("0 HEAD\n", "");
    assert.throws(() => parseGedcom(buffer(ged)), /harus diawali baris '0 HEAD'/);
  });

  test("struktur: harus diakhiri 0 TRLR", () => {
    const ged = SAMPLE.replace("0 TRLR\n", "");
    assert.throws(() => parseGedcom(buffer(ged)), /harus diakhiri baris '0 TRLR'/);
  });

  test("struktur: level melonjak >1 ditolak", () => {
    const ged = SAMPLE.replace("2 GIVN Budi\n", "3 GIVN Budi\n");
    assert.throws(() => parseGedcom(buffer(ged)), /Level GEDCOM tidak valid/);
  });

  test("file kosong ditolak", () => {
    assert.throws(() => parseGedcom(buffer("")), /kosong/);
  });

  test("baris tidak valid ditolak", () => {
    const ged = SAMPLE.replace("1 SEX M\n", "INI BUKAN BARIS VALID\n");
    assert.throws(() => parseGedcom(buffer(ged)), /Baris GEDCOM tidak valid/);
  });

  test("ukuran file > batas ditolak", () => {
    const big = Buffer.alloc(MAX_GEDCOM_BYTES + 1, "0 @I1@ INDI\n", "utf-8");
    assert.throws(() => parseGedcom(big), /Ukuran file maksimal 10MB/);
  });

  test("BOM di awal dilewati", () => {
    const ged = "\uFEFF" + SAMPLE;
    const result = parseGedcom(buffer(ged));
    assert.strictEqual(result.persons.length, 3);
  });

  test("CRLF line endings didukung", () => {
    const ged = SAMPLE.replace(/\n/g, "\r\n");
    const result = parseGedcom(buffer(ged));
    assert.strictEqual(result.persons.length, 3);
  });
});
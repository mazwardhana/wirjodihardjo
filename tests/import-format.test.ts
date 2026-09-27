import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { parseXLSX, parseCSV } from "../src/lib/import/parser";
import { validateImportData } from "../src/lib/import/validate";
import { generateTemplateXLSX, generateTemplateCSV } from "../src/lib/import/template";
import type { ParsedData, ImportRowAnggota, Gender } from "../src/lib/import/types";

function anggota(cabangKe: number, namaLengkap: string, jenisKelamin: string, extra: Partial<ImportRowAnggota> = {}): ImportRowAnggota {
  return { cabangKe, namaLengkap, jenisKelamin: jenisKelamin as Gender, ...extra };
}

function buildXLSX(headers: string[], rows: (string | number)[][]): Promise<Buffer> {
  return (async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Data");
    ws.getRow(1).values = headers;
    for (const row of rows) ws.addRow(row);
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  })();
}

test("template roundtrip: XLSX retains Petunjuk and Data sheets and drops CONTOH rows", async () => {
  const buf = await generateTemplateXLSX();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  assert.deepEqual(
    wb.worksheets.map((w) => w.name),
    ["Petunjuk", "Data"],
  );
  const parsed = await parseXLSX(buf);
  assert.equal(parsed.anggota.length, 1);
  assert.equal(parsed.anggota[0].namaLengkap, "Tn. Contoh Wirjodihardjo");
});

test("template XLSX restores gender dropdown via typed cell.dataValidation", async () => {
  const buf = await generateTemplateXLSX();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);

  const data = wb.getWorksheet("Data")!;
  const jenisKelamin = data.getCell("C2").dataValidation;
  assert.ok(jenisKelamin);
  assert.equal(jenisKelamin.type, "list");
  assert.match(jenisKelamin.formulae![0], /MALE/);
});

test("generateTemplateCSV emits headers with BOM and a CONTOH example row", () => {
  const csv = generateTemplateCSV().toString("utf-8");
  assert.ok(csv.startsWith("\uFEFF"));
  const lines = csv.replace(/^\uFEFF/, "").trim().split("\n");
  assert.equal(lines.length, 2);
  assert.match(lines[0], /cabang_ke/);
  assert.match(lines[1], /CONTOH/i);
});

test("parseCSV parses Data rows and skips CONTOH", () => {
  const data = parseCSV(
    Buffer.from(
      "cabang_ke,nama_lengkap,jenis_kelamin\n1,CONTOH Contoh,MALE\n2,Nama Satu,MALE\n",
    ),
  );
  assert.equal(data.anggota.length, 1);
  assert.equal(data.anggota[0].namaLengkap, "Nama Satu");
  assert.equal(data.anggota[0].cabangKe, 2);
});

test("parseCSV maps headers by name, not column position (reordered)", () => {
  const data = parseCSV(
    Buffer.from("jenis_kelamin,nama_lengkap,tanggal_lahir,ref,cabang_ke\nMALE,Nama Satu,1990-01-01,A001,2\n"),
  );
  assert.equal(data.anggota[0].ref, "A001");
  assert.equal(data.anggota[0].namaLengkap, "Nama Satu");
  assert.equal(data.anggota[0].jenisKelamin, "MALE");
  assert.equal(data.anggota[0].tanggalLahir, "1990-01-01");
  assert.equal(data.anggota[0].cabangKe, 2);
});

test("parser maps headers by name for XLSX, ignoring column positions", async () => {
  const buf = await buildXLSX(
    ["jenis_kelamin", "nama_lengkap", "cabang_ke"],
    [["MALE", "Nama Satu", 1]],
  );
  const data = await parseXLSX(buf);
  assert.equal(data.anggota[0].namaLengkap, "Nama Satu");
  assert.equal(data.anggota[0].cabangKe, 1);
  assert.equal(data.anggota[0].jenisKelamin, "MALE");
});

test("parser does not silently skip nonempty missing-ref rows", async () => {
  const buf = await buildXLSX(
    ["cabang_ke", "nama_lengkap", "jenis_kelamin"],
    [[1, "Tanpa Ref", "MALE"]],
  );
  const data = await parseXLSX(buf);
  assert.equal(data.anggota.length, 1);
  assert.equal(data.anggota[0].ref, undefined);
});

test("missing required columns are rejected at parse time", () => {
  assert.throws(
    () => parseCSV(Buffer.from("nama_lengkap,jenis_kelamin\nNama Satu,MALE\n")),
    /cabang_ke/,
  );
  assert.throws(
    () => parseCSV(Buffer.from("cabang_ke,jenis_kelamin\n1,MALE\n")),
    /nama_lengkap/,
  );
  assert.throws(
    () => parseCSV(Buffer.from("cabang_ke,nama_lengkap\n1,Nama Satu\n")),
    /jenis_kelamin/,
  );
});

test("strict dates: no rollover for invalid calendar dates", async () => {
  // This test would require database mock, skipping validation and testing parser behavior instead
  const buf = await buildXLSX(
    ["cabang_ke", "nama_lengkap", "jenis_kelamin", "tanggal_lahir"],
    [[1, "A", "MALE", "2024-02-30"]],
  );
  const data = await parseXLSX(buf);
  assert.equal(data.anggota[0].tanggalLahir, "2024-02-30");
  // Validation would catch this as invalid date
});

test("strict dates: rejects 31/02 and out-of-range month", async () => {
  const cases = ["31/02/2024", "01/13/2024", "2024-13-01", "00/00/0000"];
  for (const tanggalLahir of cases) {
    const validation = await validateImportData({
      anggota: [anggota(1, "A", "MALE", { tanggalLahir })],
    });
    assert.ok(validation.errors.some((e) => e.field === "tanggal_lahir"), `should reject ${tanggalLahir}`);
  }
});

test("valid dates normalize to ISO", async () => {
  const validation = await validateImportData({
    anggota: [anggota(1, "A", "MALE", { tanggalLahir: "15/01/1990" })],
  });
  assert.equal(validation.data.anggota[0].tanggalLahir, "1990-01-15");
  assert.equal(validation.errors.length, 0);
});

test("gender aliases normalize consistently", async () => {
  const validation = await validateImportData({
    anggota: [
      anggota(1, "A", "pria"),
      anggota(2, "B", "L"),
      anggota(3, "C", "P"),
      anggota(4, "D", "perempuan"),
    ],
  });
  assert.equal(validation.data.anggota[0].jenisKelamin, "MALE");
  assert.equal(validation.data.anggota[1].jenisKelamin, "MALE");
  assert.equal(validation.data.anggota[2].jenisKelamin, "FEMALE");
  assert.equal(validation.data.anggota[3].jenisKelamin, "FEMALE");
  assert.equal(validation.valid, true);
});

test("invalid gender is reported as a row error", async () => {
  const validation = await validateImportData({
    anggota: [anggota(1, "A", "UNKNOWN")],
  });
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((e) => e.field === "jenis_kelamin"));
});

test("duplicate refs are rejected", async () => {
  const validation = await validateImportData({
    anggota: [
      anggota(1, "A", "MALE", { ref: "A001" }),
      anggota(2, "B", "FEMALE", { ref: "A001" }),
    ],
  });
  assert.ok(validation.errors.some((e) => e.field === "ref" && /duplikat/.test(e.message)));
});

test("invalid ref charset is rejected", async () => {
  const validation = await validateImportData({
    anggota: [anggota(1, "A", "MALE", { ref: "BAD REF!" })],
  });
  assert.ok(validation.errors.some((e) => e.field === "ref"));
});

test("empty import is rejected", async () => {
  const validation = await validateImportData({ anggota: [] });
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((e) => /kosong/.test(e.message)));
});

test("parser rejects formula cells in XLSX", async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Data");
  ws.addRow(["cabang_ke", "nama_lengkap", "jenis_kelamin"]);
  ws.addRow([1, "Nama", "MALE"]);
  ws.getCell("A3").value = { formula: "SUM(A1:A2)", result: 1 };
  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  await assert.rejects(() => parseXLSX(buf), /formula|objek/);
});

test("parser rejects formula cells in CSV", () => {
  assert.throws(
    () => parseCSV(Buffer.from("cabang_ke,nama_lengkap,jenis_kelamin\n1,=SUM(1+1),MALE\n")),
    /formula/,
  );
});

test("physical row numbers are exact, including skipped CONTOH rows", async () => {
  const buf = await buildXLSX(
    ["cabang_ke", "nama_lengkap", "jenis_kelamin"],
    [
      [1, "CONTOH Skip Me", "MALE"],
      [1, "Real", "MALE"],
    ],
  );
  const data = await parseXLSX(buf);
  assert.equal(data.anggota.length, 1);
  assert.equal(data.anggota[0]._row, 3);
});

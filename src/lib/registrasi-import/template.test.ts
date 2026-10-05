import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { generateRegistrasiTemplateCSV, generateRegistrasiTemplateXLSX } from "./template";

test("template XLSX punya sheet Petunjuk dan Data dengan header yang benar", async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load((await generateRegistrasiTemplateXLSX()) as unknown as ExcelJS.Buffer);

  const petunjuk = workbook.getWorksheet("Petunjuk");
  assert.ok(petunjuk, "sheet Petunjuk harus ada");
  const instructions = petunjuk!
    .getColumn(1)
    .values.map((value) => String(value ?? ""))
    .join("\n");
  assert.ok(instructions.includes("12345678"), "petunjuk memuat password default");
  assert.ok(instructions.includes("CONTOH"), "petunjuk memuat aturan baris CONTOH");
  assert.ok(instructions.includes("dilewati"), "petunjuk memuat aturan baris sudah ada");
  assert.ok(instructions.includes("beberapa cabang"), "petunjuk memuat aturan multi cabang");

  const data = workbook.getWorksheet("Data");
  assert.ok(data, "sheet Data harus ada");
  const headers: string[] = [];
  data!.getRow(1).eachCell({ includeEmpty: true }, (cell) => headers.push(String(cell.value)));
  assert.deepEqual(headers, [
    "kode cabang keluarga*",
    "nama panggilan*",
    "nama lengkap*",
    "gender*",
    "status*",
    "hadir reuni",
  ]);
});

test("template XLSX memuat baris contoh yang diawali CONTOH", async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load((await generateRegistrasiTemplateXLSX()) as unknown as ExcelJS.Buffer);
  const data = workbook.getWorksheet("Data")!;
  assert.equal(String(data.getCell("A2").value), "1");
  assert.ok(String(data.getCell("C2").value).startsWith("CONTOH"), "nama lengkap contoh diawali CONTOH");
});

test("template XLSX memasang dropdown pada kolom gender, status, hadir", async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load((await generateRegistrasiTemplateXLSX()) as unknown as ExcelJS.Buffer);
  const data = workbook.getWorksheet("Data")!;
  const gender = data.getCell("D2").dataValidation;
  assert.equal(gender.type, "list");
  assert.ok(gender.formulae?.[0].includes("Laki-laki"), `gender: ${gender.formulae?.[0]}`);
  const status = data.getCell("E2").dataValidation;
  assert.equal(status.type, "list");
  assert.ok(status.formulae?.[0].includes("wafat"), `status: ${status.formulae?.[0]}`);
  const hadir = data.getCell("F2").dataValidation;
  assert.equal(hadir.type, "list");
  assert.ok(hadir.formulae?.[0].includes("ya"), `hadir: ${hadir.formulae?.[0]}`);
});

test("template CSV memuat header dan baris contoh", () => {
  const csv = generateRegistrasiTemplateCSV().toString("utf-8");
  const lines = csv.split(/\r?\n/);
  assert.equal(
    lines[0].replace(/^\uFEFF/, ""),
    "kode cabang keluarga*,nama panggilan*,nama lengkap*,gender*,status*,hadir reuni",
  );
  assert.ok(lines[1].includes("CONTOH"), `baris contoh: ${lines[1]}`);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { parseRegistrasiCSV, parseRegistrasiXLSX } from "./parser";
import { generateRegistrasiTemplateCSV, generateRegistrasiTemplateXLSX } from "./template";

const HEADERS = [
  "kode cabang keluarga*",
  "nama panggilan*",
  "nama lengkap*",
  "gender*",
  "status*",
  "hadir reuni",
];

const ROW = ["2", "Budi", "Budi Santoso", "P", "wafat", "tidak"];

function csvBuffer(headers: string[] = HEADERS, row: string[] = ROW): Buffer {
  const lines = [headers, row].map((cells) => cells.join(","));
  return Buffer.from(`${lines.join("\n")}\n`, "utf-8");
}

async function xlsxBuffer(headers: string[] = HEADERS, row: string[] = ROW): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Data");
  sheet.addRow(headers);
  sheet.addRow(row);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test("template XLSX bolak-balik: baris CONTOH diabaikan", async () => {
  const data = await parseRegistrasiXLSX(await generateRegistrasiTemplateXLSX());
  assert.equal(data.rows.length, 0);
});

test("parser XLSX membaca kolom dengan benar", async () => {
  const data = await parseRegistrasiXLSX(await xlsxBuffer());
  assert.equal(data.rows.length, 1);
  const row = data.rows[0];
  assert.equal(row._row, 2);
  assert.equal(row.cabangKe, "2");
  assert.equal(row.namaPanggilan, "Budi");
  assert.equal(row.namaLengkap, "Budi Santoso");
  assert.equal(row.gender, "P");
  assert.equal(row.status, "wafat");
  assert.equal(row.hadir, "tidak");
});

test("template CSV bolak-balik: baris CONTOH diabaikan", () => {
  const data = parseRegistrasiCSV(generateRegistrasiTemplateCSV());
  assert.equal(data.rows.length, 0);
});

test("parser CSV membaca kolom dengan benar", () => {
  const data = parseRegistrasiCSV(csvBuffer());
  assert.equal(data.rows.length, 1);
  assert.equal(data.rows[0].namaLengkap, "Budi Santoso");
});

test("header wajib yang hilang menolak dengan pesan label Indonesia", () => {
  const headers = HEADERS.filter((header) => header !== "nama lengkap*");
  assert.throws(
    () => parseRegistrasiCSV(csvBuffer(headers)),
    /Kolom wajib "nama lengkap" tidak ditemukan\./,
  );
});

test("kolom duplikat ditolak", () => {
  const headers = [...HEADERS, "jenis kelamin"];
  assert.throws(() => parseRegistrasiCSV(csvBuffer(headers)), /Kolom "jenis kelamin" duplikat\./);
});

test("sel formula CSV ditolak", () => {
  const row = ["2", "Budi", "=SUM(A1)", "P", "hidup", "ya"];
  assert.throws(() => parseRegistrasiCSV(csvBuffer(HEADERS, row)), /formula tidak diperbolehkan/);
});

test("sel formula XLSX ditolak", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Data");
  sheet.addRow(HEADERS);
  const row = sheet.addRow(["2", "Budi", "", "P", "hidup", "ya"]);
  row.getCell(3).value = { formula: "SUM(A1)", result: 1 } as unknown as ExcelJS.CellValue;
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  await assert.rejects(parseRegistrasiXLSX(buffer), /formula|objek sel/);
});

test("gender/status/hadir disimpan mentah tanpa normalisasi", async () => {
  const row = ["3", "Siti", "Siti Aminah", "L", "hidup", "ya"];
  const csv = parseRegistrasiCSV(csvBuffer(HEADERS, row));
  assert.equal(csv.rows[0].gender, "L");
  assert.equal(csv.rows[0].status, "hidup");
  assert.equal(csv.rows[0].hadir, "ya");

  const xlsx = await parseRegistrasiXLSX(await xlsxBuffer(HEADERS, row));
  assert.equal(xlsx.rows[0].gender, "L");
  assert.equal(xlsx.rows[0].status, "hidup");
  assert.equal(xlsx.rows[0].hadir, "ya");
});

test("kolom hadir boleh tidak ada", async () => {
  const headers = HEADERS.filter((header) => header !== "hadir reuni");
  const row = ["4", "Rina", "Rina Wijaya", "P", "hidup"];
  const csv = parseRegistrasiCSV(csvBuffer(headers, row));
  assert.equal(csv.rows.length, 1);
  assert.equal(csv.rows[0].hadir, "");

  const xlsx = await parseRegistrasiXLSX(await xlsxBuffer(headers, row));
  assert.equal(xlsx.rows.length, 1);
  assert.equal(xlsx.rows[0].hadir, "");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { parseCSV, parseXLSX } from "./parser";
import { generateTemplateCSV, generateTemplateXLSX } from "./template";

// Header sengaja memuat kolom nickname dan nama panggilan sekaligus untuk
// memastikan parser tidak menggabungkan keduanya ke field yang sama.
const HEADERS = [
  "kode cabang keluarga*",
  "nickname*",
  "password*",
  "nama lengkap*",
  "nama panggilan",
];

const ROW = ["1", "budi", "rahasia123", "Budi Santoso", "Budi Manis"];

function csvBuffer(): Buffer {
  const lines = [HEADERS, ROW].map((cells) => cells.join(","));
  return Buffer.from(`${lines.join("\n")}\n`, "utf-8");
}

async function xlsxBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Data");
  sheet.addRow(HEADERS);
  sheet.addRow(ROW);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test("parser CSV memisahkan kolom nickname dan nama panggilan", () => {
  const data = parseCSV(csvBuffer());
  assert.equal(data.anggota.length, 1);
  assert.equal(data.anggota[0].nickname, "budi");
  assert.equal(data.anggota[0].namaPanggilan, "Budi Manis");
});

test("parser XLSX memisahkan kolom nickname dan nama panggilan", async () => {
  const data = await parseXLSX(await xlsxBuffer());
  assert.equal(data.anggota.length, 1);
  assert.equal(data.anggota[0].nickname, "budi");
  assert.equal(data.anggota[0].namaPanggilan, "Budi Manis");
});

test("nama panggilan opsional dan boleh kosong", () => {
  const lines = [HEADERS, ["1", "budi", "rahasia123", "Budi Santoso", ""]].map((cells) => cells.join(","));
  const data = parseCSV(Buffer.from(`${lines.join("\n")}\n`, "utf-8"));
  assert.equal(data.anggota[0].nickname, "budi");
  assert.equal(data.anggota[0].namaPanggilan, undefined);
});

test("header nickname tetap wajib", () => {
  const withoutNickname = ["kode cabang keluarga*", "password*", "nama lengkap*", "nama panggilan"];
  const lines = [withoutNickname, ["1", "rahasia123", "Budi Santoso", "Budi"]].map((cells) => cells.join(","));
  assert.throws(
    () => parseCSV(Buffer.from(`${lines.join("\n")}\n`, "utf-8")),
    /nickname/,
  );
});

test("template CSV menampilkan kolom nickname* dan nama panggilan", () => {
  const csv = generateTemplateCSV().toString("utf-8");
  const header = csv.split(/\r?\n/)[0];
  assert.ok(header.includes("nickname*"), `header: ${header}`);
  assert.ok(header.includes("nama panggilan"), `header: ${header}`);
});

test("template XLSX menampilkan kolom nickname* dan nama panggilan", async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load((await generateTemplateXLSX()) as unknown as ExcelJS.Buffer);
  const sheet = workbook.getWorksheet("Data");
  assert.ok(sheet, "sheet Data harus ada");
  const headers: string[] = [];
  sheet!.getRow(1).eachCell({ includeEmpty: true }, (cell) => headers.push(String(cell.value)));
  assert.ok(headers.includes("nickname*"), `header: ${headers.join(", ")}`);
  assert.ok(headers.includes("nama panggilan"), `header: ${headers.join(", ")}`);
});

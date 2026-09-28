import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { parseXLSX, parseCSV } from "../src/lib/import/parser";
import { generateTemplateXLSX, generateTemplateCSV } from "../src/lib/import/template";
import type { Gender } from "../src/lib/import/types";

const NEW_HEADERS = [
  "kode cabang keluarga*",
  "nickname*",
  "password*",
  "nama lengkap*",
  "gender",
  "tempat kelahiran",
  "tanggal lahir",
  "nomor telepon",
  "alamat domisili",
  "kota domisili",
];

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

function asText(values: unknown[]): string[] {
  return values.map((value) => {
    if (value === null || value === undefined) return "";
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (typeof value === "object" && value !== null && "text" in value) {
      return String((value as { text?: unknown }).text ?? "");
    }
    if (typeof value === "object" && value !== null && "formula" in value) return "";
    return String(value);
  });
}

test("template XLSX has 10 new headers, one example row, and a Petunjuk sheet", async () => {
  const buf = await generateTemplateXLSX();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  assert.deepEqual(
    wb.worksheets.map((w) => w.name),
    ["Petunjuk", "Data"],
  );

  const data = wb.getWorksheet("Data")!;
  const headers = asText([...Array(10)].map((_, i) => data.getRow(1).getCell(i + 1).value));
  assert.deepEqual(headers, NEW_HEADERS);

  const exampleRow = data.getRow(2);
  const example = asText([...Array(10)].map((_, i) => exampleRow.getCell(i + 1).value));
  assert.ok(example[3].toUpperCase().startsWith("CONTOH"), "baris contoh memakai CONTOH di nama lengkap");
  assert.equal(example[0], "1");
  assert.equal(example[1], "contoh");
  assert.ok(example[2].length >= 8, "contoh password memenuhi minimal 8 karakter");

  const petunjuk = wb.getWorksheet("Petunjuk")!;
  assert.ok(String(petunjuk.getCell("A1").value ?? "").length > 0);
});

test("template XLSX applies a gender dropdown to the gender column", async () => {
  const buf = await generateTemplateXLSX();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  const data = wb.getWorksheet("Data")!;
  const gender = data.getCell("E2").dataValidation;
  assert.ok(gender);
  assert.equal(gender.type, "list");
  assert.match(gender.formulae![0], /MALE/);
});

test("template CSV has the 10 new headers with BOM and one CONTOH example row", () => {
  const csv = generateTemplateCSV().toString("utf-8");
  assert.ok(csv.startsWith("\uFEFF"));
  const lines = csv.replace(/^\uFEFF/, "").trim().split("\n");
  assert.equal(lines.length, 2);
  assert.equal(lines[0], NEW_HEADERS.join(","));
  assert.match(lines[1], /CONTOH/i);
});

test("parseCSV parses the 10 columns and skips CONTOH", () => {
  const data = parseCSV(
    Buffer.from(
      [
        NEW_HEADERS.join(","),
        "1,contoh,contohpw,CONTOH Wirjodihardjo,MALE,Jakarta,1950-01-15,0812,Jl. Contoh,Nocontoh",
        "2,budi,rahasia123,Nama Satu,Laki-laki,Depok,15/06/1990,081234567890,Jl. Merdeka,Bandung",
      ].join("\n") + "\n",
    ),
  );
  assert.equal(data.anggota.length, 1);
  const row = data.anggota[0];
  assert.equal(row.cabangKe, "2");
  assert.equal(row.namaLengkap, "Nama Satu");
  assert.equal(row.namaPanggilan, "budi");
  assert.equal(row.password, "rahasia123");
  assert.equal(row.jenisKelamin, "Laki-laki");
  assert.equal(row.tempatLahir, "Depok");
  assert.equal(row.tanggalLahir, "15/06/1990");
  assert.equal(row.nomorTelepon, "081234567890");
  assert.equal(row.alamatDomisili, "Jl. Merdeka");
  assert.equal(row.kotaDomisili, "Bandung");
});

test("header parsing ignores asterisk, spacing, and underscore variants", () => {
  const data = parseCSV(
    Buffer.from(
      "Kode_Cabang_Keluarga*,NICKNAME*,Password*,Nama Lengkap,Gender,Tempat Kelahiran,Tanggal Lahir,Nomor Telepon,Alamat Domisili,Kota Domisili\n1,budi,rahasia123,Budi Santoso,Male,Jakarta,1990-01-01,0812,Jl. A,Jakarta\n",
    ),
  );
  assert.equal(data.anggota.length, 1);
  assert.equal(data.anggota[0].namaPanggilan, "budi");
  assert.equal(data.anggota[0].cabangKe, "1");
  assert.equal(data.anggota[0].alamatDomisili, "Jl. A");
});

test("missing required columns are rejected at parse time", () => {
  assert.throws(
    () => parseCSV(Buffer.from("nickname*,password*,nama lengkap*\nbudi,rahasia123,Budi\n")),
    /kode cabang keluarga/,
  );
  assert.throws(
    () => parseCSV(Buffer.from("kode cabang keluarga*,password*,nama lengkap*\n1,rahasia123,Budi\n")),
    /nickname/,
  );
  assert.throws(
    () => parseCSV(Buffer.from("kode cabang keluarga*,nickname*,nama lengkap*\n1,budi,Budi\n")),
    /password/,
  );
  assert.throws(
    () => parseCSV(Buffer.from("kode cabang keluarga*,nickname*,password*\n1,budi,rahasia123\n")),
    /nama lengkap/,
  );
});

test("reordered columns still map by header name", () => {
  const data = parseCSV(
    Buffer.from("nama lengkap,password,nickname,kode cabang keluarga\nBudi Santoso,rahasia123,budi,3\n"),
  );
  assert.equal(data.anggota[0].cabangKe, "3");
  assert.equal(data.anggota[0].namaPanggilan, "budi");
  assert.equal(data.anggota[0].password, "rahasia123");
  assert.equal(data.anggota[0].namaLengkap, "Budi Santoso");
});

test("physical row numbers are exact, including skipped CONTOH rows", async () => {
  const buf = await buildXLSX(NEW_HEADERS, [
    ["1", "budi", "rahasia123", "CONTOH Skip Me", "MALE"],
    ["1", "budi", "rahasia123", "Real", "MALE"],
  ]);
  const data = await parseXLSX(buf);
  assert.equal(data.anggota.length, 1);
  assert.equal(data.anggota[0]._row, 3);
});

test("parser rejects formula cells in XLSX", async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Data");
  ws.addRow(NEW_HEADERS);
  ws.addRow(["1", "budi", "rahasia123", "Nama", "MALE"]);
  ws.getCell("D3").value = { formula: "SUM(A1:A2)", result: 1 };
  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  await assert.rejects(() => parseXLSX(buf), /formula|objek/);
});

test("parser rejects formula cells in CSV", () => {
  assert.throws(
    () =>
      parseCSV(
        Buffer.from(
          "kode cabang keluarga*,nickname*,password*,nama lengkap*\n1,budi,rahasia123,=SUM(1+1)\n",
        ),
      ),
    /formula/,
  );
});

test("parser rejects files over 10MB", () => {
  const oversized = Buffer.alloc(11 * 1024 * 1024, 0);
  assert.throws(() => parseCSV(oversized), /10MB/);
});

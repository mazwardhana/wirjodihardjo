import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { parseXLSX, parseCSV } from "../src/lib/import/parser";
import { validateImportData } from "../src/lib/import/validate";
import { generateTemplateXLSX, generateTemplateCSV } from "../src/lib/import/template";
import type { ParsedData, ImportRowAnggota, Gender } from "../src/lib/import/types";

function anggota(ref: string, namaLengkap: string, jenisKelamin: string, extra: Record<string, string> = {}): ImportRowAnggota {
  return { ref, namaLengkap, jenisKelamin: jenisKelamin as Gender, ...extra };
}

function buildXLSX(sheets: { name: string; headers: string[]; rows: (string | number)[][] }[]): Promise<Buffer> {
  return (async () => {
    const wb = new ExcelJS.Workbook();
    const required = ["Anggota", "Relasi", "Akun"];
    for (const name of required) {
      if (!sheets.some((s) => s.name === name)) {
        const ws = wb.addWorksheet(name);
        ws.addRow(name === "Anggota" ? ["ref", "nama_lengkap", "jenis_kelamin"] : name === "Relasi" ? ["ref_orang", "jenis_relasi", "ref_target"] : ["ref_orang", "email_akun", "peran"]);
      }
    }
    for (const sheet of sheets) {
      const ws = wb.getWorksheet(sheet.name) ?? wb.addWorksheet(sheet.name);
      ws.getRow(1).values = sheet.headers;
      for (const row of sheet.rows) ws.addRow(row);
    }
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  })();
}

test("template roundtrip: XLSX retains 4 sheets and drops CONTOH rows", async () => {
  const buf = await generateTemplateXLSX();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  assert.deepEqual(
    wb.worksheets.map((w) => w.name),
    ["Petunjuk", "Anggota", "Relasi", "Akun"],
  );
  const parsed = await parseXLSX(buf);
  assert.equal(parsed.anggota.length, 0);
  assert.equal(parsed.relasi.length, 0);
  assert.equal(parsed.akun.length, 0);
});

test("template XLSX restores dropdowns via typed cell.dataValidation", async () => {
  const buf = await generateTemplateXLSX();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);

  const relasi = wb.getWorksheet("Relasi")!;
  const jenisRelasi = relasi.getCell("B2").dataValidation;
  assert.ok(jenisRelasi);
  assert.equal(jenisRelasi.type, "list");
  assert.match(jenisRelasi.formulae![0], /ORANG_TUA/);

  const anggota = wb.getWorksheet("Anggota")!;
  const jenisKelamin = anggota.getCell("D2").dataValidation;
  assert.ok(jenisKelamin);
  assert.equal(jenisKelamin.type, "list");
  assert.match(jenisKelamin.formulae![0], /MALE/);
});

test("generateTemplateCSV emits headers with BOM and a CONTOH example row", () => {
  const csv = generateTemplateCSV("Anggota").toString("utf-8");
  assert.ok(csv.startsWith("\uFEFF"));
  const lines = csv.replace(/^\uFEFF/, "").trim().split("\n");
  assert.equal(lines.length, 2);
  assert.match(lines[0], /ref/);
  assert.match(lines[1], /CONTOH_A001/);

  const relasi = generateTemplateCSV("Relasi").toString("utf-8").replace(/^\uFEFF/, "").trim().split("\n");
  assert.match(relasi[0], /peran/);
  assert.match(relasi[1], /CONTOH_A002/);

  const akun = generateTemplateCSV("Akun").toString("utf-8").replace(/^\uFEFF/, "").trim().split("\n");
  assert.match(akun[0], /email_akun/);
  assert.match(akun[1], /CONTOH_A001/);
});

test("parseCSV infers Anggota, Relasi, Akun and skips CONTOH", () => {
  const anggota = parseCSV(
    Buffer.from(
      "ref,nama_lengkap,jenis_kelamin\nCONTOH_A001,Contoh,MALE\nA001,Nama Satu,MALE\n",
    ),
  );
  assert.equal(anggota.anggota.length, 1);
  assert.equal(anggota.anggota[0].ref, "A001");

  const relasi = parseCSV(Buffer.from("ref_orang,jenis_relasi,ref_target\nA002,ORANG_TUA,A001\n"));
  assert.equal(relasi.relasi.length, 1);

  const akun = parseCSV(Buffer.from("ref_orang,email_akun,peran\nA001,a@b.co,MEMBER\n"));
  assert.equal(akun.akun.length, 1);
});

test("parseCSV maps headers by name, not column position (reordered)", () => {
  const data = parseCSV(
    Buffer.from("jenis_kelamin,nama_lengkap,tanggal_lahir,ref\nMALE,Nama Satu,1990-01-01,A001\n"),
  );
  assert.equal(data.anggota[0].ref, "A001");
  assert.equal(data.anggota[0].namaLengkap, "Nama Satu");
  assert.equal(data.anggota[0].jenisKelamin, "MALE");
  assert.equal(data.anggota[0].tanggalLahir, "1990-01-01");
});

test("parseCSV supports alias headers incl peran/adopsi/tiri", () => {
  const data = parseCSV(
    Buffer.from("ref_orang,jenis_relasi,ref_target,peran,adopsi,tiri\nA002,ORANG_TUA,A001,FATHER,Ya,tidak\n"),
  );
  assert.equal(data.relasi[0].peranOrangTua, "FATHER");
  assert.equal(data.relasi[0].adopsi, "Ya");
  assert.equal(data.relasi[0].tiri, "tidak");
});

test("parser maps headers by name for XLSX, ignoring column positions", async () => {
  const buf = await buildXLSX([
    { name: "Anggota", headers: ["jenis_kelamin", "nama_lengkap", "ref"], rows: [["MALE", "Nama Satu", "A001"]] },
  ]);
  const data = await parseXLSX(buf);
  assert.equal(data.anggota[0].ref, "A001");
  assert.equal(data.anggota[0].namaLengkap, "Nama Satu");
});

test("parser does not silently skip nonempty missing-ref rows", async () => {
  const buf = await buildXLSX([
    { name: "Anggota", headers: ["ref", "nama_lengkap", "jenis_kelamin"], rows: [["", "Tanpa Ref", "MALE"]] },
  ]);
  const data = await parseXLSX(buf);
  assert.equal(data.anggota.length, 1);
  assert.equal(data.anggota[0].ref, "");
  const validation = validateImportData(data);
  assert.ok(validation.errors.some((e) => e.field === "ref"));
});

test("strict dates: no rollover for invalid calendar dates", () => {
  const data: ParsedData = {
    anggota: [anggota("A001", "A", "MALE", { tanggalLahir: "2024-02-30" })],
    relasi: [],
    akun: [],
  };
  const validation = validateImportData(data);
  assert.ok(validation.errors.some((e) => e.field === "tanggal_lahir"));
  assert.equal(validation.valid, false);
});

test("strict dates: rejects 31/02 and out-of-range month", () => {
  const cases = ["31/02/2024", "01/13/2024", "2024-13-01", "00/00/0000"];
  for (const tanggalLahir of cases) {
    const validation = validateImportData({
      anggota: [anggota("A001", "A", "MALE", { tanggalLahir })],
      relasi: [],
      akun: [],
    });
    assert.ok(validation.errors.some((e) => e.field === "tanggal_lahir"), `should reject ${tanggalLahir}`);
  }
});

test("valid dates normalize to ISO", () => {
  const validation = validateImportData({
    anggota: [anggota("A001", "A", "MALE", { tanggalLahir: "15/01/1990" })],
    relasi: [],
    akun: [],
  });
  assert.equal(validation.data.anggota[0].tanggalLahir, "1990-01-15");
  assert.equal(validation.errors.length, 0);
});

test("enum aliases normalize consistently", () => {
  const validation = validateImportData({
    anggota: [anggota("A001", "A", "pria")],
    relasi: [],
    akun: [],
  });
  assert.equal(validation.data.anggota[0].jenisKelamin, "MALE");
  assert.equal(validation.valid, true);
});

test("boolean fields validate and normalize", () => {
  const data: ParsedData = {
    anggota: [anggota("A001", "A", "MALE", { meninggal: "ya" })],
    relasi: [
      { refOrang: "A001", refTarget: "A002", jenisRelasi: "ORANG_TUA", adopsi: "Ya", tiri: "tidak" },
    ],
    akun: [],
  };
  data.anggota.push(anggota("A002", "B", "FEMALE"));
  const validation = validateImportData(data);
  assert.equal(validation.data.anggota[0].meninggal, "true");
  assert.equal(validation.data.relasi[0].adopsi, "true");
  assert.equal(validation.data.relasi[0].tiri, "false");

  const bad = validateImportData({
    anggota: [anggota("A001", "A", "MALE", { meninggal: "mungkin" })],
    relasi: [],
    akun: [],
  });
  assert.ok(bad.errors.some((e) => e.field === "meninggal"));
});

test("duplicate refs are rejected", () => {
  const validation = validateImportData({
    anggota: [anggota("A001", "A", "MALE"), anggota("A001", "B", "FEMALE")],
    relasi: [],
    akun: [],
  });
  assert.ok(validation.errors.some((e) => e.field === "ref" && /duplikat/.test(e.message)));
});

test("unique account refs: duplicate account ref is rejected", () => {
  const validation = validateImportData({
    anggota: [anggota("A001", "A", "MALE")],
    relasi: [],
    akun: [
      { ref: "A001", email: "a@b.co", peran: "MEMBER" },
      { ref: "A001", email: "c@b.co", peran: "MEMBER" },
    ],
  });
  assert.ok(validation.errors.some((e) => /lebih dari satu akun/.test(e.message)));
});

test("duplicated relations do not count as extra parents", () => {
  const data: ParsedData = {
    anggota: [anggota("C", "Child", "MALE"), anggota("P", "Parent", "FEMALE")],
    relasi: [
      { refOrang: "C", refTarget: "P", jenisRelasi: "ORANG_TUA" },
      { refOrang: "C", refTarget: "P", jenisRelasi: "ORANG_TUA" },
    ],
    akun: [],
  };
  const validation = validateImportData(data);
  assert.ok(!validation.errors.some((e) => /melebihi batas/.test(e.message)));
});

test("more than 2 distinct parents is rejected", () => {
  const data: ParsedData = {
    anggota: [anggota("C", "Child", "MALE"), anggota("P1", "P1", "MALE"), anggota("P2", "P2", "FEMALE"), anggota("P3", "P3", "FEMALE")],
    relasi: [
      { refOrang: "C", refTarget: "P1", jenisRelasi: "ORANG_TUA" },
      { refOrang: "C", refTarget: "P2", jenisRelasi: "ORANG_TUA" },
      { refOrang: "C", refTarget: "P3", jenisRelasi: "ORANG_TUA" },
    ],
    akun: [],
  };
  const validation = validateImportData(data);
  assert.ok(validation.errors.some((e) => /melebihi batas 2 orang tua/.test(e.message)));
});

test("cycles are reported with row numbers", () => {
  const data: ParsedData = {
    anggota: [anggota("A", "A", "MALE"), anggota("B", "B", "FEMALE")],
    relasi: [
      { _row: 2, refOrang: "A", refTarget: "B", jenisRelasi: "ORANG_TUA" },
      { _row: 3, refOrang: "B", refTarget: "A", jenisRelasi: "ORANG_TUA" },
    ],
    akun: [],
  };
  const validation = validateImportData(data);
  const cycleErrors = validation.errors.filter((e) => /siklus/.test(e.message));
  assert.ok(cycleErrors.length >= 1);
  assert.ok(cycleErrors.every((e) => e.row !== 0), "cycle errors must carry a physical row");
});

test("empty import is rejected", () => {
  const validation = validateImportData({ anggota: [], relasi: [], akun: [] });
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((e) => /kosong/.test(e.message)));
});

test("parser rejects formula cells in XLSX", async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Anggota");
  ws.addRow(["ref", "nama_lengkap", "jenis_kelamin"]);
  ws.addRow(["A001", "Nama", "MALE"]);
  ws.getCell("A3").value = { formula: "SUM(A1:A2)", result: 1 };
  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  await assert.rejects(() => parseXLSX(buf), /formula|objek/);
});

test("parser rejects formula cells in CSV", () => {
  assert.throws(
    () => parseCSV(Buffer.from("ref,nama_lengkap,jenis_kelamin\nA001,=SUM(1+1),MALE\n")),
    /formula/,
  );
});

test("defaults: empty peran defaults to MEMBER", () => {
  const validation = validateImportData({
    anggota: [anggota("A001", "A", "MALE")],
    relasi: [],
    akun: [{ ref: "A001", email: "a@b.co", peran: "" as never }],
  });
  assert.equal(validation.data.akun[0].peran, "MEMBER");
});

test("physical row numbers are exact, including skipped CONTOH rows", async () => {
  const buf = await buildXLSX([
    {
      name: "Anggota",
      headers: ["ref", "nama_lengkap", "jenis_kelamin"],
      rows: [
        ["CONTOH_X", "Skip Me", "MALE"],
        ["A001", "Real", "MALE"],
      ],
    },
  ]);
  const data = await parseXLSX(buf);
  assert.equal(data.anggota.length, 1);
  assert.equal(data.anggota[0]._row, 3);
});

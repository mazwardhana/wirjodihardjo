import ExcelJS from "exceljs";
import { parse } from "csv-parse/sync";
import { MAX_IMPORT_BYTES } from "./types";
import type { ParsedData, Gender } from "./types";

const MAX_ROWS = 5000;
const MAX_CELLS = 100_000;
const MAX_COLUMNS = 50;
const MAX_CELL_LENGTH = 32_767;
type Budget = { rows: number; cells: number };
type Values = Record<string, string>;

function normalizeHeader(value: string): string {
  return value.replace(/\uFEFF/g, "").replace(/\*/g, "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

const HEADER_MAP: Record<string, string> = {
  cabang_ke: "cabangKe",
  nama_lengkap: "namaLengkap",
  jenis_kelamin: "jenisKelamin",
  nama_panggilan: "namaPanggilan",
  tempat_lahir: "tempatLahir",
  tanggal_lahir: "tanggalLahir",
  kota_domisili: "kotaDomisili",
  nomor_telepon: "nomorTelepon",
  catatan: "catatan",
  ref: "ref",
};

const REQUIRED = ["cabangKe", "namaLengkap", "jenisKelamin"];

function mapHeaders(headers: string[]): (string | undefined)[] {
  const seen = new Set<string>();
  const columns = headers.map((header) => {
    const key = normalizeHeader(header);
    const field = Object.prototype.hasOwnProperty.call(HEADER_MAP, key) ? HEADER_MAP[key] : undefined;
    if (field && seen.has(field)) throw new Error(`Kolom "${header}" duplikat.`);
    if (field) seen.add(field);
    return field;
  });
  for (const required of REQUIRED) {
    if (!seen.has(required)) {
      const display = Object.entries(HEADER_MAP).find(([_, v]) => v === required)?.[0] || required;
      throw new Error(`Kolom wajib "${display}" tidak ditemukan.`);
    }
  }
  return columns;
}

function checkBuffer(buffer: Buffer): void {
  if (buffer.length > MAX_IMPORT_BYTES) throw new Error("Ukuran file maksimal 10MB.");
}

function checkCell(value: string, location: string): string {
  const trimmed = value.trim();
  if (trimmed.length > MAX_CELL_LENGTH) throw new Error(`${location}: isi sel terlalu panjang.`);
  if (/^[=@]/.test(trimmed) || /^[+-](?![\d\s().-]+$)/.test(trimmed)) {
    throw new Error(`${location}: formula tidak diperbolehkan.`);
  }
  return trimmed;
}

function cellString(cell: ExcelJS.Cell, sheet: string): string {
  const location = `${sheet}!${cell.address}`;
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error(`${location}: tanggal tidak valid.`);
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "object") throw new Error(`${location}: formula atau objek sel tidak diperbolehkan.`);
  if (typeof value === "number" && !Number.isFinite(value)) throw new Error(`${location}: angka tidak valid.`);
  return checkCell(String(value), location);
}

function consumeRow(values: string[], budget: Budget): boolean {
  if (values.length > MAX_COLUMNS) throw new Error(`Maksimal ${MAX_COLUMNS} kolom per baris.`);
  budget.cells += values.length;
  if (budget.cells > MAX_CELLS) throw new Error(`Maksimal ${MAX_CELLS} sel per file.`);
  if (values.every((value) => !value)) return false;
  budget.rows++;
  if (budget.rows > MAX_ROWS) throw new Error(`Maksimal ${MAX_ROWS} baris data per file.`);
  return true;
}

function appendRow(data: ParsedData, columns: (string | undefined)[], cells: string[], row: number): void {
  const values: Values = {};
  columns.forEach((field, index) => {
    if (field) values[field] = cells[index] ?? "";
  });
  
  // Skip example rows
  if (values.namaLengkap?.toUpperCase().startsWith("CONTOH")) return;
  
  data.anggota.push({
    _row: row,
    cabangKe: values.cabangKe ? Number(values.cabangKe) : 0,
    namaLengkap: values.namaLengkap ?? "",
    jenisKelamin: (values.jenisKelamin ?? "") as Gender,
    namaPanggilan: values.namaPanggilan || undefined,
    tempatLahir: values.tempatLahir || undefined,
    tanggalLahir: values.tanggalLahir || undefined,
    kotaDomisili: values.kotaDomisili || undefined,
    nomorTelepon: values.nomorTelepon || undefined,
    catatan: values.catatan || undefined,
    ref: values.ref || undefined,
  });
}

export async function parseXLSX(buffer: Buffer): Promise<ParsedData> {
  checkBuffer(buffer);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const data: ParsedData = { anggota: [] };
  const budget: Budget = { rows: 0, cells: 0 };
  
  const sheet = workbook.getWorksheet("Data") || workbook.worksheets.find(ws => ws.name !== "Petunjuk");
  if (!sheet) throw new Error("Sheet 'Data' tidak ditemukan.");
  
  if (sheet.columnCount > MAX_COLUMNS || sheet.rowCount > MAX_ROWS + 1) {
    throw new Error(`Maksimal ${MAX_ROWS} baris data dan ${MAX_COLUMNS} kolom.`);
  }
  
  const headers: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell) => headers.push(cellString(cell, sheet.name)));
  const columns = mapHeaders(headers);
  
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => cells.push(cellString(cell, sheet.name)));
    if (consumeRow(cells, budget)) appendRow(data, columns, cells, rowNumber);
  });
  
  return data;
}

export function parseCSV(buffer: Buffer): ParsedData {
  checkBuffer(buffer);
  const data: ParsedData = { anggota: [] };
  const budget: Budget = { rows: 0, cells: 0 };
  let columns: (string | undefined)[] = [];
  let headerParsed = false;
  
  parse(buffer, {
    bom: true,
    skip_empty_lines: false,
    relax_column_count: true,
    max_record_size: MAX_CELL_LENGTH * MAX_COLUMNS,
    on_record: (record: string[], info) => {
      const rowNumber = info.lines - record.reduce((sum, value) => sum + (value.match(/\r\n|\r|\n/g)?.length ?? 0), 0);
      if (info.lines > MAX_ROWS + 1) throw new Error(`Maksimal ${MAX_ROWS} baris data per file.`);
      const cells = record.map((value, index) => checkCell(value, `CSV baris ${rowNumber} kolom ${index + 1}`));
      
      if (!headerParsed) {
        if (cells.every((value) => !value)) return null;
        if (cells.length > MAX_COLUMNS) throw new Error(`Maksimal ${MAX_COLUMNS} kolom per baris.`);
        columns = mapHeaders(cells);
        headerParsed = true;
      } else if (consumeRow(cells, budget)) {
        if (cells.length > columns.length && cells.slice(columns.length).some(Boolean)) {
          throw new Error(`CSV baris ${rowNumber}: data tanpa header kolom.`);
        }
        appendRow(data, columns, cells, rowNumber);
      }
      return null;
    },
  });
  
  return data;
}

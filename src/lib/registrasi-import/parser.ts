import ExcelJS from "exceljs";
import { parse } from "csv-parse/sync";
import type { ParsedRegistrasi, RegistrasiImportRow } from "./types";
import {
  MAX_ROWS,
  MAX_COLUMNS,
  MAX_CELL_LENGTH,
  normalizeHeader,
  checkBuffer,
  checkCell,
  cellString,
  consumeRow,
  type Budget,
  type Values,
} from "@/lib/import/guards";

const HEADER_MAP: Record<string, string> = {
  kode_cabang_keluarga: "cabangKe",
  cabang_ke: "cabangKe",
  nama_panggilan: "namaPanggilan",
  nama_lengkap: "namaLengkap",
  gender: "gender",
  jenis_kelamin: "gender",
  status: "status",
  hadir_reuni: "hadir",
  hadir: "hadir",
};

/** Kolom wajib ada pada header file. */
const REQUIRED = ["cabangKe", "namaPanggilan", "namaLengkap", "gender", "status"];

/** Label tampilan (untuk pesan error) mengikuti judul kolom template. */
const REQUIRED_LABEL: Record<string, string> = {
  cabangKe: "kode cabang keluarga",
  namaPanggilan: "nama panggilan",
  namaLengkap: "nama lengkap",
  gender: "gender",
  status: "status",
};

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
      const display = REQUIRED_LABEL[required] ?? required;
      throw new Error(`Kolom wajib "${display}" tidak ditemukan.`);
    }
  }
  return columns;
}

function appendRow(
  data: ParsedRegistrasi,
  columns: (string | undefined)[],
  cells: string[],
  row: number,
): void {
  const values: Values = {};
  columns.forEach((field, index) => {
    if (field) values[field] = cells[index] ?? "";
  });

  // Skip example rows
  if (values.namaLengkap?.toUpperCase().startsWith("CONTOH")) return;

  const entry: RegistrasiImportRow = {
    _row: row,
    cabangKe: values.cabangKe ?? "",
    namaPanggilan: values.namaPanggilan ?? "",
    namaLengkap: values.namaLengkap ?? "",
    gender: values.gender ?? "",
    status: values.status ?? "",
    hadir: values.hadir ?? "",
  };
  data.rows.push(entry);
}

export async function parseRegistrasiXLSX(buffer: Buffer): Promise<ParsedRegistrasi> {
  checkBuffer(buffer);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const data: ParsedRegistrasi = { rows: [] };
  const budget: Budget = { rows: 0, cells: 0 };

  const sheet = workbook.getWorksheet("Data") || workbook.worksheets.find((ws) => ws.name !== "Petunjuk");
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

export function parseRegistrasiCSV(buffer: Buffer): ParsedRegistrasi {
  checkBuffer(buffer);
  const data: ParsedRegistrasi = { rows: [] };
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

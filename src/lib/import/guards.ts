import ExcelJS from "exceljs";
import { MAX_IMPORT_BYTES } from "./types";

/**
 * Guard bersama untuk pembaca XLSX/CSV: pembatas ukuran, sel, kolom, dan
 * penolakan formula. Dipakai parser impor anggota dan parser impor registrasi
 * supaya keduanya memakai aturan keamanan yang sama tanpa duplikasi.
 */

export const MAX_ROWS = 5000;
export const MAX_CELLS = 100_000;
export const MAX_COLUMNS = 50;
export const MAX_CELL_LENGTH = 32_767;

export type Budget = { rows: number; cells: number };
export type Values = Record<string, string>;

/** Samakan nama header: buang BOM & tanda wajib, huruf kecil, spasi/garis jadi `_`. */
export function normalizeHeader(value: string): string {
  return value.replace(/\uFEFF/g, "").replace(/\*/g, "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function checkBuffer(buffer: Buffer): void {
  if (buffer.length > MAX_IMPORT_BYTES) throw new Error("Ukuran file maksimal 10MB.");
}

export function checkCell(value: string, location: string): string {
  const trimmed = value.trim();
  if (trimmed.length > MAX_CELL_LENGTH) throw new Error(`${location}: isi sel terlalu panjang.`);
  if (/^[=@]/.test(trimmed) || /^[+-](?![\d\s().-]+$)/.test(trimmed)) {
    throw new Error(`${location}: formula tidak diperbolehkan.`);
  }
  return trimmed;
}

export function cellString(cell: ExcelJS.Cell, sheet: string): string {
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

/** Tandai satu baris data: tolak melebihi batas sel/baris/kolom, abaikan baris kosong. */
export function consumeRow(values: string[], budget: Budget): boolean {
  if (values.length > MAX_COLUMNS) throw new Error(`Maksimal ${MAX_COLUMNS} kolom per baris.`);
  budget.cells += values.length;
  if (budget.cells > MAX_CELLS) throw new Error(`Maksimal ${MAX_CELLS} sel per file.`);
  if (values.every((value) => !value)) return false;
  budget.rows++;
  if (budget.rows > MAX_ROWS) throw new Error(`Maksimal ${MAX_ROWS} baris data per file.`);
  return true;
}

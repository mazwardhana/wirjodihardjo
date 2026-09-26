import ExcelJS from "exceljs";
import { parse } from "csv-parse/sync";
import { MAX_IMPORT_BYTES } from "./types";
import type { ParsedData, Gender, ParentRole, PartnerStatus, UserRole, RelationKind } from "./types";

const MAX_ROWS = 5000;
const MAX_CELLS = 100_000;
const MAX_COLUMNS = 50;
const MAX_CELL_LENGTH = 32_767;
type SheetName = "Anggota" | "Relasi" | "Akun";
type Budget = { rows: number; cells: number };
type Values = Record<string, string>;

function normalizeHeader(value: string): string {
  return value.replace(/\uFEFF/g, "").replace(/\*/g, "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

const HEADERS: Record<SheetName, Record<string, string>> = {
  Anggota: {
    ref: "ref", nama_lengkap: "namaLengkap", nama_panggilan: "namaPanggilan", jenis_kelamin: "jenisKelamin",
    tanggal_lahir: "tanggalLahir", tempat_lahir: "tempatLahir", meninggal: "meninggal", tanggal_meninggal: "tanggalMeninggal",
    bio: "bio", cabang: "cabang", level_generasi: "levelGenerasi", telepon: "telepon", whatsapp: "whatsapp", email: "email",
    alamat: "alamat", kota: "kota", provinsi: "provinsi", kode_pos: "kodePos", status_pernikahan: "statusPernikahan", catatan_keluarga: "catatanKeluarga",
  },
  Relasi: {
    ref_orang: "refOrang", ref: "refOrang", jenis_relasi: "jenisRelasi", ref_target: "refTarget",
    peran: "peranOrangTua", peran_orang_tua: "peranOrangTua", adopsi: "adopsi", is_adopted: "adopsi",
    tiri: "tiri", is_step: "tiri", tanggal_menikah: "tanggalMenikah", status_pasangan: "statusPasangan",
  },
  Akun: { ref_orang: "ref", ref: "ref", email_akun: "email", email: "email", peran: "peran", role: "peran" },
};
const REQUIRED: Record<SheetName, string[]> = {
  Anggota: ["ref", "namaLengkap", "jenisKelamin"],
  Relasi: ["refOrang", "jenisRelasi", "refTarget"],
  Akun: ["ref", "email"],
};

function mapHeaders(headers: string[], sheet: SheetName): (string | undefined)[] {
  const seen = new Set<string>();
  const columns = headers.map((header) => {
    const key = normalizeHeader(header);
    const field = Object.prototype.hasOwnProperty.call(HEADERS[sheet], key) ? HEADERS[sheet][key] : undefined;
    if (field && seen.has(field)) throw new Error(`${sheet}: kolom "${header}" duplikat.`);
    if (field) seen.add(field);
    return field;
  });
  for (const required of REQUIRED[sheet]) {
    if (!seen.has(required)) throw new Error(`${sheet}: kolom wajib "${required}" tidak ditemukan.`);
  }
  return columns;
}

function checkBuffer(buffer: Buffer): void {
  if (buffer.length > MAX_IMPORT_BYTES) throw new Error("Ukuran file maksimal 10MB.");
}

function checkCell(value: string, location: string): string {
  const trimmed = value.trim();
  if (trimmed.length > MAX_CELL_LENGTH) throw new Error(`${location}: isi sel terlalu panjang.`);
  // A leading + remains valid for telephone numbers; executable spreadsheet text does not.
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

function appendRow(data: ParsedData, sheet: SheetName, columns: (string | undefined)[], cells: string[], row: number): void {
  const values: Values = {};
  columns.forEach((field, index) => {
    if (field) values[field] = cells[index] ?? "";
  });
  const ref = sheet === "Relasi" ? values.refOrang : values.ref;
  if (ref?.toUpperCase().startsWith("CONTOH")) return;
  if (sheet === "Anggota") {
    data.anggota.push({
      ...values, _row: row, ref: values.ref ?? "", namaLengkap: values.namaLengkap ?? "",
      jenisKelamin: (values.jenisKelamin ?? "") as Gender,
    });
  } else if (sheet === "Relasi") {
    data.relasi.push({
      ...values, _row: row, refOrang: values.refOrang ?? "", refTarget: values.refTarget ?? "",
      jenisRelasi: (values.jenisRelasi ?? "") as RelationKind,
      peranOrangTua: values.peranOrangTua as ParentRole | undefined,
      statusPasangan: values.statusPasangan as PartnerStatus | undefined,
    });
  } else {
    data.akun.push({ _row: row, ref: values.ref ?? "", email: values.email ?? "", peran: (values.peran ?? "") as UserRole });
  }
}

export async function parseXLSX(buffer: Buffer): Promise<ParsedData> {
  checkBuffer(buffer);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const data: ParsedData = { anggota: [], relasi: [], akun: [] };
  const budget: Budget = { rows: 0, cells: 0 };
  for (const name of ["Anggota", "Relasi", "Akun"] as const) {
    const sheet = workbook.getWorksheet(name);
    if (!sheet) throw new Error(`Sheet ${name} tidak ditemukan.`);
    if (sheet.columnCount > MAX_COLUMNS || sheet.rowCount > MAX_ROWS + 1) {
      throw new Error(`${name}: maksimal ${MAX_ROWS} baris data dan ${MAX_COLUMNS} kolom.`);
    }
    const headers: string[] = [];
    sheet.getRow(1).eachCell({ includeEmpty: true }, (cell) => headers.push(cellString(cell, name)));
    const columns = mapHeaders(headers, name);
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => cells.push(cellString(cell, name)));
      if (consumeRow(cells, budget)) appendRow(data, name, columns, cells, rowNumber);
    });
  }
  return data;
}

export function parseCSV(buffer: Buffer): ParsedData {
  checkBuffer(buffer);
  const data: ParsedData = { anggota: [], relasi: [], akun: [] };
  const budget: Budget = { rows: 0, cells: 0 };
  let sheet: SheetName | undefined;
  let columns: (string | undefined)[] = [];
  parse(buffer, {
    bom: true,
    skip_empty_lines: false,
    relax_column_count: true,
    max_record_size: MAX_CELL_LENGTH * MAX_COLUMNS,
    on_record: (record: string[], info) => {
      const rowNumber = info.lines - record.reduce((sum, value) => sum + (value.match(/\r\n|\r|\n/g)?.length ?? 0), 0);
      if (info.lines > MAX_ROWS + 1) throw new Error(`Maksimal ${MAX_ROWS} baris data per file.`);
      const cells = record.map((value, index) => checkCell(value, `CSV baris ${rowNumber} kolom ${index + 1}`));
      if (!sheet) {
        if (cells.every((value) => !value)) return null;
        const names = new Set(cells.map(normalizeHeader));
        if (names.has("jenis_relasi")) sheet = "Relasi";
        else if (names.has("nama_lengkap") || names.has("jenis_kelamin")) sheet = "Anggota";
        else if (names.has("email_akun") || names.has("email")) sheet = "Akun";
        else throw new Error("Header CSV tidak dikenali. Gunakan template Anggota, Relasi, atau Akun.");
        if (cells.length > MAX_COLUMNS) throw new Error(`Maksimal ${MAX_COLUMNS} kolom per baris.`);
        columns = mapHeaders(cells, sheet);
      } else if (consumeRow(cells, budget)) {
        if (cells.length > columns.length && cells.slice(columns.length).some(Boolean)) {
          throw new Error(`CSV baris ${rowNumber}: data tanpa header kolom.`);
        }
        appendRow(data, sheet, columns, cells, rowNumber);
      }
      return null;
    },
  });
  return data;
}

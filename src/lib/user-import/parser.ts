import { parse } from "csv-parse/sync";

/**
 * Baris data hasil parsing CSV impor user. `line` adalah nomor baris fisik
 * (1-based) tempat record dimulai, digunakan untuk pesan error per baris.
 */
export type UserImportRow = {
  line: number;
  username: string;
  password: string;
  namaLengkap: string;
  email: string | null;
};

export class UserImportParseError extends Error {
  readonly line: number | null;

  constructor(message: string, line: number | null = null) {
    super(message);
    this.name = "UserImportParseError";
    this.line = line;
  }
}

const HEADER_FIELDS = ["username", "password", "nama_lengkap"] as const;
const ALL_FIELDS: Array<"username" | "password" | "namaLengkap" | "email"> = [
  "username",
  "password",
  "namaLengkap",
  "email",
];

const HEADER_TOKEN: Record<string, string> = {
  username: "username",
  password: "password",
  namaLengkap: "nama_lengkap",
  email: "email",
};

type RawRecord = { line: number; cells: string[] };

function normalizeHeader(value: string): string {
  return value.replace(/\uFEFF/g, "").trim().toLowerCase();
}

function parseRawRecords(input: string | Buffer): RawRecord[] {
  const records: RawRecord[] = [];
  try {
    parse(input, {
      bom: true,
      relax_column_count: true,
      skip_empty_lines: true,
      on_record: (record: string[], info: { lines: number }) => {
        const embedded = record.reduce(
          (sum, value) => sum + (value.match(/\r\n|\r|\n/g)?.length ?? 0),
          0,
        );
        const line = info.lines - embedded;
        const cells = record.map((value) => value.trim());
        if (cells.every((value) => !value)) return null;
        records.push({ line, cells });
        return null;
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "berkas tidak dapat dibaca";
    const match = /line (\d+)/.exec(detail);
    const line = match ? Number(match[1]) : null;
    throw new UserImportParseError(`Format CSV tidak valid: ${detail}`, line);
  }
  return records;
}

function detectHeader(first: RawRecord): boolean {
  const cells = first.cells.map(normalizeHeader);
  return HEADER_FIELDS.every((field) => cells.includes(field));
}

function buildColumnMap(headers: string[]): (number | -1)[] {
  const normalized = headers.map(normalizeHeader);
  return ALL_FIELDS.map((field) => {
    const index = normalized.indexOf(HEADER_TOKEN[field]);
    return index === -1 ? -1 : index;
  });
}

function buildPositionalMap(): (number | -1)[] {
  return [0, 1, 2, 3];
}

function toRow(
  record: RawRecord,
  columnMap: (number | -1)[],
  knownIndices: Set<number>,
): UserImportRow {
  for (let i = 0; i < record.cells.length; i++) {
    if (record.cells[i].trim() && !knownIndices.has(i)) {
      throw new UserImportParseError(
        `CSV baris ${record.line}: kolom pada posisi ${i + 1} tidak valid.`,
        record.line,
      );
    }
  }
  const value = (index: number): string =>
    index === -1 ? "" : record.cells[index] ?? "";
  const email = value(columnMap[3]);
  return {
    line: record.line,
    username: value(columnMap[0]),
    password: value(columnMap[1]),
    namaLengkap: value(columnMap[2]),
    email: email ? email : null,
  };
}

/**
 * Parse CSV impor user murni (bukan Excel). Kolom `username,password,nama_lengkap,email`
 * dengan `email` opsional. Header opsional; bila tidak ada header, kolom dipetakan
 * berdasarkan posisi. Menghasilkan baris lengkap dengan nomor baris untuk pelaporan error.
 */
export function parseUserImportCsv(input: string | Buffer): UserImportRow[] {
  const records = parseRawRecords(input);
  if (records.length === 0) return [];

  const hasHeader = detectHeader(records[0]);
  const headerCells = records[0].cells;

  let columnMap: (number | -1)[];
  let dataRecords: RawRecord[];

  if (hasHeader) {
    for (const field of HEADER_FIELDS) {
      if (!headerCells.map(normalizeHeader).includes(field)) {
        throw new UserImportParseError(
          `Kolom wajib "${field}" tidak ditemukan.`,
          records[0].line,
        );
      }
    }
    columnMap = buildColumnMap(headerCells);
    dataRecords = records.slice(1);
  } else {
    // No header detected: require at least 3 columns so data is meaningful.
    // If the first row lacks required columns it's a structural problem.
    const firstRow = records[0].cells;
    if (firstRow.length < 3) {
      throw new UserImportParseError(
        `CSV baris ${records[0].line}: kolom tidak lengkap (minimal 3 kolom diperlukan).`,
        records[0].line,
      );
    }
    columnMap = buildPositionalMap();
    dataRecords = records;
  }

  const knownIndices = new Set(
    columnMap.filter((idx) => idx !== -1).map(Number),
  );

  const rows: UserImportRow[] = [];
  for (const record of dataRecords) {
    rows.push(toRow(record, columnMap, knownIndices));
  }
  return rows;
}

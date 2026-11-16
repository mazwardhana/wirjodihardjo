import { MAX_GEDCOM_BYTES, type GedcomFamily, type GedcomParseResult, type GedcomPerson } from "./types";

/**
 * Parser GEDCOM 5.5.1 untuk format LINEAGE-LINKED.
 *
 * Repo tidak memakai paket GEDCOM apa pun, jadi pembacaan dilakukan langsung
 * dari format baris (`0 @I1@ INDI`). Hanya dua jenis catatan yang diambil:
 * INDI (orang) dan FAM (keluarga). Catatan lain (HEAD, SUBM, NOTE global,
 * OBJE, dll.) dilewati tanpa error karena tidak dibutuhkan impor silsilah.
 */

const MAX_LINES = 5000;
const MAX_LINE_LENGTH = 32_767;

type ParsedLine = {
  level: number;
  xref?: string;
  tag: string;
  value: string;
  line: number;
};

type GedcomRecord = {
  top: ParsedLine;
  children: ParsedLine[];
};

const LINE_PATTERN = /^(\d+)\s+(?:(@[^@]+@)\s+)?([A-Za-z0-9_]+)(?:\s+(.*))?$/;
const XREF_PATTERN = /@I[^@]+@/;

const MONTHS: Record<string, number> = {
  JAN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11,
};

function buildDate(year: number, month: number, day: number): Date | null {
  if (!Number.isInteger(year) || year < 1 || year > 9999) return null;
  if (month < 0 || month > 11) return null;
  if (day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

/**
 * Ubah tanggal GEDCOM menjadi Date.
 *
 * GEDCOM mengizinkan kualifikasi (ABT/EST/CAL/BET..AND..). Untuk kualifikasi
 * seperti itu diambil tahun pertama yang masuk akal, bukan tanggal tepat,
 * karena impor silsilah hanya butuh perkiraan tahun. Nilai mentahnya tetap
 * disimpan pemanggil agar tidak hilang.
 */
export function parseGedcomDate(raw: string | undefined): Date | null {
  const original = (raw ?? "").trim();
  if (!original) return null;

  let text = original.toUpperCase();

  if (/^BET\s+/.test(text)) {
    text = text.replace(/^BET\s+/, "").split(/\s+AND\s+/)[0].trim();
  } else if (/^(ABT|EST|CAL|FROM|TO|AFT|BEF)\s+/.test(text)) {
    text = text.replace(/^(ABT|EST|CAL|FROM|TO|AFT|BEF)\s+/, "").trim();
  }
  if (/\s+TO\s+/.test(text)) text = text.split(/\s+TO\s+/)[0].trim();

  const dmy = /^(\d{1,2})\s+([A-Z]{3})\s+(\d{4})$/.exec(text);
  if (dmy) {
    const month = MONTHS[dmy[2]];
    if (month === undefined) return null;
    return buildDate(Number(dmy[3]), month, Number(dmy[1]));
  }

  const my = /^([A-Z]{3})\s+(\d{4})$/.exec(text);
  if (my) {
    const month = MONTHS[my[1]];
    if (month === undefined) return null;
    return buildDate(Number(my[2]), month, 1);
  }

  const y = /^(\d{4})$/.exec(text);
  if (y) return buildDate(Number(y[1]), 0, 1);

  // Fallback: biarkan mesin tanggal bawaan mencoba format lain. Hasil tetap
  // ditolak bila tidak valid supaya tidak ada tanggal "Invalid Date" masuk DB.
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getUTCFullYear();
  if (year < 1 || year > 9999) return null;
  return parsed;
}

function splitName(raw: string): { fullName: string; givenName?: string; surname?: string } {
  const value = raw.trim();
  if (!value) return { fullName: "" };

  const match = /\/([^/]*)\//.exec(value);
  if (!match) return { fullName: value };

  const surname = match[1].trim();
  const given = value.replace(match[0], " ").replace(/\s+/g, " ").trim();
  const fullName = [given, surname].filter(Boolean).join(" ");
  return {
    fullName,
    givenName: given || undefined,
    surname: surname || undefined,
  };
}

type Entry = { tag: string; value: string; subs: ParsedLine[] };

/** Kelompokkan anak level 1 (beserta cucu level 2) dari satu catatan level 0. */
function groupEntries(children: ParsedLine[]): Entry[] {
  const entries: Entry[] = [];
  let current: Entry | null = null;
  for (const child of children) {
    if (child.level === 1) {
      current = { tag: child.tag.toUpperCase(), value: child.value, subs: [] };
      entries.push(current);
    } else if (child.level === 2 && current) {
      current.subs.push(child);
    }
  }
  return entries;
}

function firstValue(entries: Entry[], tag: string): string | undefined {
  const found = entries.find((entry) => entry.tag === tag);
  return found ? found.value : undefined;
}

function subValue(entry: Entry, tag: string): string | undefined {
  const found = entry.subs.find((sub) => sub.tag.toUpperCase() === tag);
  return found ? found.value : undefined;
}

/** Gabungkan NOTE/OCCU multi-baris: CONT memecah baris, CONC menyambung. */
function joinMultiline(entry: Entry): string {
  let text = entry.value;
  for (const sub of entry.subs) {
    const tag = sub.tag.toUpperCase();
    if (tag === "CONT") text += `\n${sub.value}`;
    else if (tag === "CONC") text += sub.value;
  }
  return text.trim();
}

function noteFromEntries(entries: Entry[]): string | undefined {
  const notes = entries
    .filter((entry) => entry.tag === "NOTE")
    .map((entry) => joinMultiline(entry))
    .filter(Boolean);
  return notes.length ? notes.join("\n") : undefined;
}

function parseLines(text: string): ParsedLine[] {
  const rawLines = text.split(/\r\n|\r|\n/);
  const lines: ParsedLine[] = [];

  for (let index = 0; index < rawLines.length; index++) {
    const raw = rawLines[index].trim();
    if (!raw) continue;
    const lineNo = index + 1;

    if (raw.length > MAX_LINE_LENGTH) {
      throw new Error(`Baris ${lineNo} terlalu panjang.`);
    }

    const match = LINE_PATTERN.exec(raw);
    if (!match) {
      throw new Error(`Baris GEDCOM tidak valid pada baris ${lineNo}.`);
    }

    const level = Number(match[1]);
    const tag = match[3].trim();
    if (!tag) {
      throw new Error(`Tag GEDCOM kosong pada baris ${lineNo}.`);
    }

    lines.push({
      level,
      xref: match[2],
      tag,
      value: match[4] ?? "",
      line: lineNo,
    });
  }

  return lines;
}

function validateStructure(lines: ParsedLine[]): void {
  if (lines.length === 0) {
    throw new Error("File GEDCOM kosong.");
  }
  if (lines.length > MAX_LINES) {
    throw new Error(`Maksimal ${MAX_LINES} baris.`);
  }

  const first = lines[0];
  if (first.level !== 0 || first.tag.toUpperCase() !== "HEAD") {
    throw new Error("File GEDCOM harus diawali baris '0 HEAD'.");
  }

  const last = lines[lines.length - 1];
  if (last.level !== 0 || last.tag.toUpperCase() !== "TRLR") {
    throw new Error("File GEDCOM harus diakhiri baris '0 TRLR'.");
  }

  let previousLevel = -1;
  for (const line of lines) {
    if (!Number.isInteger(line.level) || line.level < 0 || line.level > 99) {
      throw new Error(`Level GEDCOM tidak valid pada baris ${line.line}.`);
    }
    if (line.level > previousLevel + 1) {
      throw new Error(`Level GEDCOM tidak valid pada baris ${line.line}.`);
    }
    previousLevel = line.level;
  }
}

function buildRecords(lines: ParsedLine[]): GedcomRecord[] {
  const records: GedcomRecord[] = [];
  let current: GedcomRecord | null = null;

  for (const line of lines) {
    if (line.level === 0) {
      current = { top: line, children: [] };
      records.push(current);
    } else if (current) {
      current.children.push(line);
    }
  }

  return records;
}

function parseIndividual(record: GedcomRecord, warnings: string[]): GedcomPerson | null {
  const xref = record.top.xref;
  if (!xref || !XREF_PATTERN.test(xref)) return null;

  const gedcomId = xref;
  const entries = groupEntries(record.children);

  const nameValue = firstValue(entries, "NAME") ?? "";
  const name = splitName(nameValue);
  const given = firstValue(entries, "GIVN")?.trim() || name.givenName;
  const surname = firstValue(entries, "SURN")?.trim() || name.surname;
  const fullName = [given, surname].filter(Boolean).join(" ") || name.fullName;

  const sexRaw = (firstValue(entries, "SEX") ?? "").trim().toUpperCase();
  let gender: GedcomPerson["gender"] = "OTHER";
  if (sexRaw === "M" || sexRaw === "MALE") gender = "MALE";
  else if (sexRaw === "F" || sexRaw === "FEMALE") gender = "FEMALE";
  else if (sexRaw) warnings.push(`SEX '${sexRaw}' pada ${gedcomId} tidak dikenali, diisi OTHER.`);

  const nicknameEntry = entries.find((entry) => entry.tag === "NICK");
  const nickSub = entries
    .filter((entry) => entry.tag === "NAME")
    .flatMap((entry) => entry.subs)
    .find((sub) => sub.tag.toUpperCase() === "NICK" && sub.value.trim());
  const nickname = (nicknameEntry?.value.trim() || nickSub?.value.trim()) || undefined;

  const birth = entries.find((entry) => entry.tag === "BIRT");
  const birthDateRaw = birth ? subValue(birth, "DATE")?.trim() || undefined : undefined;
  const birthDate = birthDateRaw ? parseGedcomDate(birthDateRaw) : null;
  const birthPlace = birth ? subValue(birth, "PLAC")?.trim() || undefined : undefined;

  const death = entries.find((entry) => entry.tag === "DEAT");
  const deathDateRaw = death ? subValue(death, "DATE")?.trim() || undefined : undefined;
  const deathDate = deathDateRaw ? parseGedcomDate(deathDateRaw) : null;
  const deathPlace = death ? subValue(death, "PLAC")?.trim() || undefined : undefined;

  const occupationEntry = entries.find((entry) => entry.tag === "OCCU");
  const occupation = occupationEntry ? joinMultiline(occupationEntry) || undefined : undefined;

  return {
    gedcomId,
    fullName,
    givenName: given,
    surname,
    nickname,
    gender,
    birthDateRaw,
    birthDate,
    birthPlace,
    deathDateRaw,
    deathDate,
    deathPlace,
    isDeceased: Boolean(death),
    occupation,
    notes: noteFromEntries(entries),
  };
}

function parseFamily(record: GedcomRecord): GedcomFamily | null {
  const xref = record.top.xref;
  if (!xref) return null;

  const entries = groupEntries(record.children);
  const personRef = (value: string | undefined): string | undefined => {
    if (!value) return undefined;
    const match = XREF_PATTERN.exec(value.trim());
    return match ? match[0] : undefined;
  };

  const husband = personRef(firstValue(entries, "HUSB"));
  const wife = personRef(firstValue(entries, "WIFE"));
  const children = entries
    .filter((entry) => entry.tag === "CHIL")
    .map((entry) => personRef(entry.value))
    .filter((value): value is string => Boolean(value));

  const marriage = entries.find((entry) => entry.tag === "MARR");
  const marriageDateRaw = marriage ? subValue(marriage, "DATE")?.trim() || undefined : undefined;
  const marriageDate = marriageDateRaw ? parseGedcomDate(marriageDateRaw) : null;

  const divorce = entries.find((entry) => entry.tag === "DIV");
  const divorceDateRaw = divorce ? subValue(divorce, "DATE")?.trim() || undefined : undefined;
  const divorceDate = divorceDateRaw ? parseGedcomDate(divorceDateRaw) : null;

  let status: GedcomFamily["status"] = "UNKNOWN";
  if (divorce) status = "DIVORCED";
  else if (marriage) status = "MARRIED";

  return {
    gedcomId: xref,
    husband,
    wife,
    children,
    marriageDateRaw,
    marriageDate,
    divorceDateRaw,
    divorceDate,
    status,
    notes: noteFromEntries(entries),
  };
}

/**
 * Baca buffer GEDCOM menjadi daftar orang dan keluarga.
 *
 * Melempar Error dengan pesan berbahasa Indonesia untuk berkas yang terlalu
 * besar, terlalu panjang, atau strukturnya tidak valid; pemanggil (route
 * unggah) mengubahnya menjadi respons 400.
 */
export function parseGedcom(buffer: Buffer): GedcomParseResult {
  if (buffer.length > MAX_GEDCOM_BYTES) {
    throw new Error("Ukuran file maksimal 10MB.");
  }

  // BOM di awal berkas membuat baris pertama gagal cocok pola level.
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const lines = parseLines(text);
  validateStructure(lines);

  const records = buildRecords(lines);
  const warnings: string[] = [];

  let charSet = "UTF-8";
  let sourceName: string | undefined;
  const persons: GedcomPerson[] = [];
  const families: GedcomFamily[] = [];

  for (const record of records) {
    const tag = record.top.tag.toUpperCase();

    if (tag === "HEAD") {
      const entries = groupEntries(record.children);
      charSet = firstValue(entries, "CHAR")?.trim() || charSet;
      const sour = firstValue(entries, "SOUR")?.trim();
      if (sour && !sour.startsWith("@")) sourceName = sour;
      continue;
    }

    if (tag === "INDI") {
      const person = parseIndividual(record, warnings);
      if (person) persons.push(person);
      continue;
    }

    if (tag === "FAM") {
      const family = parseFamily(record);
      if (family) families.push(family);
    }
  }

  return {
    persons,
    families,
    charSet,
    sourceName,
    warnings: warnings.length ? warnings : undefined,
  };
}

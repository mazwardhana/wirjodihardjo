import { MAX_CELL_LENGTH } from "@/lib/import/guards";
import type {
  GedcomParseResult,
  GedcomValidationError,
  GedcomValidationResult,
} from "./types";

/**
 * Validasi murni (tanpa database) untuk data hasil parser GEDCOM.
 *
 * Error = impor tidak boleh lanjut; warning = data dipakai apa adanya. Aturan
 * gender tidak pernah menjadi error karena GEDCOM sah tanpa SEX; gender yang
 * tidak dikenal sudah dinormalkan menjadi OTHER oleh parser.
 */

const NAMA_MAX = 200;

function ghostMessage(ref: string): string {
  return `Referensi ${ref} pada keluarga tidak ditemukan.`;
}

function personError(
  record: string,
  field: string,
  message: string,
  line?: number,
): GedcomValidationError {
  return { record, field, message, line };
}

export function validateGedcom(data: GedcomParseResult): GedcomValidationResult {
  const errors: GedcomValidationError[] = [];
  const warnings: string[] = [];

  const persons = Array.isArray(data?.persons) ? data.persons : [];
  const families = Array.isArray(data?.families) ? data.families : [];

  if (persons.length === 0) {
    errors.push({
      record: "INDI",
      field: "INDI",
      message: "File GEDCOM tidak memuat orang (INDI).",
    });
    return { valid: false, errors, warnings, data };
  }

  const ids = new Set(persons.map((person) => person.gedcomId));

  for (const person of persons) {
    const name = person.fullName.trim();

    if (!name) {
      errors.push(personError(person.gedcomId, "NAME", "Nama lengkap wajib diisi."));
    } else if (name.length > NAMA_MAX) {
      errors.push(
        personError(
          person.gedcomId,
          "NAME",
          `Nama lengkap maksimal ${NAMA_MAX} karakter.`,
        ),
      );
    }

    if ((person.occupation?.length ?? 0) > MAX_CELL_LENGTH) {
      errors.push(
        personError(person.gedcomId, "OCCU", "Occupation terlalu panjang."),
      );
    }

    if ((person.notes?.length ?? 0) > MAX_CELL_LENGTH) {
      errors.push(personError(person.gedcomId, "NOTE", "Catatan terlalu panjang."));
    }

    if (person.birthDateRaw && !person.birthDate) {
      warnings.push("Tanggal lahir tidak dikenali, disimpan sebagai teks.");
    }

    if (person.deathDateRaw && !person.deathDate) {
      warnings.push(`Tanggal wafat '${person.deathDateRaw}' tidak dikenali, disimpan sebagai teks.`);
    }
  }

  for (const family of families) {
    const record = family.gedcomId || "FAM";

    if (family.husband && family.wife && family.husband === family.wife) {
      errors.push(
        personError(record, "HUSB/WIFE", "HUSB dan WIFE pada keluarga yang sama tidak boleh sama."),
      );
    }

    for (const ref of [family.husband, family.wife]) {
      if (ref && !ids.has(ref)) {
        errors.push(personError(record, "HUSB/WIFE", ghostMessage(ref)));
      }
    }

    const seenChildren = new Set<string>();
    for (const child of family.children) {
      if (!ids.has(child)) {
        errors.push(personError(record, "CHIL", ghostMessage(child)));
        continue;
      }
      if (family.husband === child || family.wife === child) {
        errors.push(
          personError(
            record,
            "CHIL",
            `Orang ${child} tidak boleh menjadi anak dan orang tua sekaligus.`,
          ),
        );
      }
      if (seenChildren.has(child)) {
        warnings.push(`Anak ${child} muncul dua kali di keluarga ${record}.`);
      }
      seenChildren.add(child);
    }
  }

  for (const warning of data.warnings ?? []) {
    warnings.push(warning);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: Array.from(new Set(warnings)),
    data,
  };
}
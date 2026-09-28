import { stringify } from "csv-stringify/sync";
import type { ImportReport, ImportCredential, ValidationError } from "./types";

/**
 * Generate credential report as CSV for download.
 *
 * Password sengaja tidak disertakan: password plaintext tidak pernah disimpan
 * maupun dikirim ke laporan. Anggota memakai kredensial awal dari admin dan
 * wajib menggantinya saat login pertama (`mustChangeCredentials`).
 */
export function generateCredentialCSV(credentials: ImportCredential[]): Buffer {
  const records = credentials.map((c) => ({
    fullName: c.fullName,
    username: c.username,
    role: c.role,
    status: c.status,
  }));

  const csv = stringify(records, {
    header: true,
    escape_formulas: true,
    columns: {
      fullName: "Nama Lengkap",
      username: "Username",
      role: "Peran",
      status: "Status",
    },
  });

  return Buffer.from(csv, "utf-8");
}

/**
 * Generate error report as CSV for download.
 */
export function generateErrorCSV(errors: ValidationError[]): Buffer {
  const records = errors.map((e) => ({
    sheet: e.sheet,
    baris: e.row,
    kolom: e.field,
    pesan: e.message,
  }));

  const csv = stringify(records, {
    header: true,
    escape_formulas: true,
    columns: {
      sheet: "Sheet",
      baris: "Baris",
      kolom: "Kolom",
      pesan: "Pesan Error",
    },
  });

  return Buffer.from(csv, "utf-8");
}

/**
 * Generate import summary text (untuk log atau display).
 */
export function generateImportSummary(report: ImportReport): string {
  const lines: string[] = [];
  lines.push(`Impor Data: ${report.filename}`);
  lines.push(`Status: ${report.status}`);
  lines.push(`Total baris: ${report.totalRows}`);
  lines.push(`Sukses: ${report.successRows}`);
  lines.push(`Error: ${report.errorRows}`);
  lines.push("");

  if (report.counts) {
    lines.push("Rincian:");
    lines.push(`  Anggota dibuat: ${report.counts.personsCreated}`);
    lines.push(`  Baris dilewati: ${report.counts.rowsSkipped}`);
    lines.push(`  Akun dibuat: ${report.counts.accountsCreated}`);
    lines.push(`  Data privat: ${report.counts.privateUpserts}`);
  }

  if (report.skipped?.length) {
    lines.push("");
    lines.push("Dilewati:");
    report.skipped.forEach((row) => {
      lines.push(`  - ${row.fullName} (cabang ${row.branchNumber}): ${row.reason}`);
    });
  }

  if (report.warnings.length > 0) {
    lines.push("");
    lines.push("Peringatan:");
    report.warnings.forEach((w) => lines.push(`  - ${w}`));
  }

  if (report.errors.length > 0) {
    lines.push("");
    lines.push("Error:");
    report.errors.slice(0, 10).forEach((e) => {
      lines.push(`  - [${e.sheet} baris ${e.row}] ${e.field}: ${e.message}`);
    });
    if (report.errors.length > 10) {
      lines.push(`  ... dan ${report.errors.length - 10} error lainnya`);
    }
  }

  return lines.join("\n");
}

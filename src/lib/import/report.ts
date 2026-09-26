import { stringify } from "csv-stringify/sync";
import type { ImportReport, ImportCredential, ValidationError } from "./types";

/**
 * Generate credential report as CSV for download.
 */
export function generateCredentialCSV(credentials: ImportCredential[], defaultPassword: string): Buffer {
  const records = credentials.map((c) => ({
    ref: c.ref,
    nama_lengkap: c.fullName,
    email: c.email,
    peran: c.role,
    password: c.isNew ? defaultPassword : "",
    status: c.isNew ? "Baru" : "Sudah ada",
    catatan: c.isNew ? "Wajib ganti password saat login pertama" : "Password tidak berubah",
  }));

  const csv = stringify(records, {
    header: true,
    escape_formulas: true,
    columns: {
      ref: "Ref",
      nama_lengkap: "Nama Lengkap",
      email: "Email",
      peran: "Peran",
      password: "Password",
      status: "Status",
      catatan: "Catatan",
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
    lines.push(`  Anggota diperbarui: ${report.counts.personsUpdated}`);
    lines.push(`  Akun dibuat: ${report.counts.accountsCreated}`);
    lines.push(`  Akun diperbarui: ${report.counts.accountsUpdated}`);
    lines.push(`  Relasi orang tua-anak: ${report.counts.childEdgesCreated}`);
    lines.push(`  Relasi pasangan: ${report.counts.partnerEdgesCreated}`);
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

import ExcelJS from "exceljs";
import { stringify } from "csv-stringify/sync";

/** Baris validasi diterapkan mulai baris 2 sampai batas ini (di luar baris contoh). */
const VALIDATION_LAST_ROW = 1000;

const HEADERS = [
  "kode cabang keluarga*",
  "nama panggilan*",
  "nama lengkap*",
  "gender*",
  "status*",
  "hadir reuni",
] as const;

const WIDTHS = [24, 24, 32, 16, 16, 16];

/** Kolom dropdown (0-based). */
const DROPDOWNS = [
  { column: 3, options: ["L", "P", "Laki-laki", "Perempuan"] },
  { column: 4, options: ["hidup", "wafat", "meninggal"] },
  { column: 5, options: ["ya", "tidak"] },
];

const EXAMPLE_ROW = [
  "1",
  "Contoh Panggilan",
  "CONTOH Nama Lengkap",
  "L",
  "hidup",
  "ya",
];

function styleHeader(sheet: ExcelJS.Worksheet, argb: string): void {
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

function applyDropdowns(sheet: ExcelJS.Worksheet): void {
  for (const { column, options } of DROPDOWNS) {
    for (let row = 2; row <= VALIDATION_LAST_ROW; row++) {
      sheet.getCell(row, column + 1).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`"${options.join(",")}"`],
        showErrorMessage: true,
        errorTitle: "Nilai tidak valid",
        error: `Pilih salah satu: ${options.join(", ")}.`,
      };
    }
  }
}

export async function generateRegistrasiTemplateXLSX(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  // ── Sheet 1: Petunjuk ───────────────────
  const petunjuk = workbook.addWorksheet("Petunjuk");
  petunjuk.columns = [{ width: 90 }];

  const instructions = [
    "PETUNJUK PENGGUNAAN TEMPLATE IMPOR REGISTRASI KELUARGA",
    "",
    "Setiap baris membuat data anggota (Person) beserta akun login.",
    "Password default akun adalah 12345678 dan wajib diganti saat login pertama.",
    "",
    "Sheet 'Data' (6 kolom, urut sesuai template):",
    "   1. kode cabang keluarga*: nomor cabang atau nama cabang (wajib)",
    "   2. nama panggilan*: dipakai untuk menurunkan username (wajib)",
    "   3. nama lengkap*: nama lengkap anggota (wajib)",
    "   4. gender*: L/P atau Laki-laki/Perempuan (wajib)",
    "   5. status*: hidup/wafat/meninggal (wajib)",
    "   6. hadir reuni: ya/tidak (opsional)",
    "",
    "Aturan lain:",
    "- Baris dengan nama lengkap diawali 'CONTOH' akan diabaikan",
    "- Baris yang sudah ada (cabang + nama lengkap) akan dilewati",
    "- Satu berkas boleh memuat beberapa cabang",
    "- Ukuran file maksimal 10MB",
    "",
    "Simpan file ini dan isi sheet Data sesuai kebutuhan.",
  ];

  instructions.forEach((line, i) => {
    const cell = petunjuk.getCell(`A${i + 1}`);
    cell.value = line;
    if (i === 0) cell.font = { bold: true, size: 14 };
  });

  // ── Sheet 2: Data ────────────────────
  const data = workbook.addWorksheet("Data");
  data.columns = HEADERS.map((header, i) => ({ header, key: `c${i}`, width: WIDTHS[i] }));
  styleHeader(data, "FFE8F4E6");

  data.addRow(EXAMPLE_ROW.reduce<Record<string, string>>((row, value, index) => {
    row[`c${index}`] = value;
    return row;
  }, {}));

  applyDropdowns(data);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** CSV template dengan header dan baris contoh yang sama seperti sheet XLSX. */
export function generateRegistrasiTemplateCSV(): Buffer {
  return Buffer.from(
    stringify([[...HEADERS], [...EXAMPLE_ROW]], { bom: true }),
    "utf-8",
  );
}

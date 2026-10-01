import ExcelJS from "exceljs";
import { stringify } from "csv-stringify/sync";

/** Baris validasi diterapkan mulai baris 2 sampai batas ini (di luar baris contoh). */
const VALIDATION_LAST_ROW = 1000;

const HEADERS = [
  "kode cabang keluarga*",
  "nickname*",
  "nama panggilan",
  "password*",
  "nama lengkap*",
  "gender",
  "tempat kelahiran",
  "tanggal lahir",
  "nomor telepon",
  "alamat domisili",
  "kota domisili",
] as const;

const WIDTHS = [22, 20, 24, 18, 30, 16, 20, 16, 20, 34, 20];

/** Kolom dropdown (0-based). */
const DROPDOWNS = [
  { column: 5, options: ["MALE", "FEMALE", "OTHER", "L", "P", "LAKI-LAKI", "PEREMPUAN"] },
];

const EXAMPLE_ROW = [
  "1",
  "contoh",
  "Contoh Panggilan",
  "rahasiacontoh",
  "CONTOH Tn. Wirjodihardjo",
  "MALE",
  "Jakarta",
  "1950-01-15",
  "081234567890",
  "Jl. Contoh No. 1",
  "Surabaya",
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

export async function generateTemplateXLSX(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  // ── Sheet 1: Petunjuk ───────────────────
  const petunjuk = workbook.addWorksheet("Petunjuk");
  petunjuk.columns = [{ width: 80 }];

  const instructions = [
    "PETUNJUK PENGGUNAAN TEMPLATE IMPOR MEMBER KELUARGA",
    "",
    "Setiap baris membuat akun login anggota (role MEMBER) beserta datanya.",
    "",
    "Sheet 'Data' (11 kolom, urut sesuai template):",
    "   1. kode cabang keluarga*: nomor cabang (1-10) ATAU nama cabang (wajib)",
    "   2. nickname*: 2-50 karakter, dipakai untuk menurunkan username (wajib)",
    "   3. nama panggilan: nama sehari-hari untuk ditampilkan, maks 100 karakter (opsional)",
    "   4. password*: minimal 8 karakter, akan di-hash (wajib)",
    "   5. nama lengkap*: nama lengkap anggota (wajib)",
    "   6. gender: MALE/FEMALE/OTHER atau L/P/Laki-laki/Perempuan (opsional)",
    "      - kosong diisi OTHER",
    "   7. tempat kelahiran: (opsional)",
    "   8. tanggal lahir: format YYYY-MM-DD atau DD/MM/YYYY (opsional)",
    "   9. nomor telepon: (opsional)",
    "   10. alamat domisili: (opsional)",
    "   11. kota domisili: (opsional)",
    "",
    "Aturan lain:",
    "- Baris dengan nama lengkap diawali 'CONTOH' akan diabaikan",
    "- Baris yang sudah ada (cabang + nama lengkap) akan dilewati, dilaporkan 'sudah ada, dilewati'",
    "- Password tidak pernah disimpan dalam bentuk plaintext dan tidak muncul di laporan",
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
export function generateTemplateCSV(): Buffer {
  return Buffer.from(
    stringify([[...HEADERS], [...EXAMPLE_ROW]], { bom: true }),
    "utf-8",
  );
}

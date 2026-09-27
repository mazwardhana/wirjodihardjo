import ExcelJS from "exceljs";
import { stringify } from "csv-stringify/sync";

/** Baris validasi diterapkan mulai baris 2 sampai batas ini (di luar baris contoh). */
const VALIDATION_LAST_ROW = 1000;

const HEADERS = [
  "cabang_ke*",
  "nama_lengkap*",
  "jenis_kelamin*",
  "nama_panggilan",
  "tempat_lahir",
  "tanggal_lahir",
  "kota_domisili",
  "nomor_telepon",
  "catatan",
] as const;

const WIDTHS = [12, 30, 18, 20, 20, 16, 20, 20, 40];

/** Kolom dropdown (0-based). */
const DROPDOWNS = [
  { column: 2, options: ["MALE", "FEMALE", "OTHER", "L", "P"] },
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
    "PETUNJUK PENGGUNAAN TEMPLATE IMPOR DATA ANGGOTA",
    "",
    "1. Sheet 'Data': Data identitas anggota keluarga",
    "   - cabang_ke: nomor cabang (1-10, wajib)",
    "   - nama_lengkap: nama lengkap (wajib)",
    "   - jenis_kelamin: L/P atau MALE/FEMALE/OTHER (wajib)",
    "   - nama_panggilan: nama panggilan (opsional)",
    "   - tempat_lahir: tempat lahir (opsional)",
    "   - tanggal_lahir: format YYYY-MM-DD atau DD/MM/YYYY (opsional)",
    "   - kota_domisili: kota domisili (opsional)",
    "   - nomor_telepon: nomor telepon (opsional)",
    "   - catatan: catatan tambahan (opsional)",
    "",
    "2. Baris dengan nama diawali 'CONTOH' akan diabaikan",
    "3. Ukuran file maksimal 10MB",
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

  data.addRow({
    c0: "1",
    c1: "Tn. Contoh Wirjodihardjo",
    c2: "MALE",
    c3: "Contoh",
    c4: "Jakarta",
    c5: "1950-01-15",
    c6: "Surabaya",
    c7: "081234567890",
    c8: "Pendiri cabang contoh",
  });

  applyDropdowns(data);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** CSV template dengan header dan baris contoh yang sama seperti sheet XLSX. */
export function generateTemplateCSV(): Buffer {
  return Buffer.from(
    stringify(
      [
        [...HEADERS],
        ["1", "Tn. Contoh Wirjodihardjo", "MALE", "Contoh", "Jakarta", "1950-01-15", "Surabaya", "081234567890", "Pendiri cabang contoh"],
      ],
      { bom: true },
    ),
    "utf-8",
  );
}

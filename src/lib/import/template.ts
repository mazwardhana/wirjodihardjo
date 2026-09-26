import ExcelJS from "exceljs";
import { stringify } from "csv-stringify/sync";

type TemplateSheet = "Anggota" | "Relasi" | "Akun";

/** Baris validasi diterapkan mulai baris 2 sampai batas ini (di luar baris contoh). */
const VALIDATION_LAST_ROW = 1000;

const ANGGOTA_HEADERS = [
  "ref*",
  "nama_lengkap*",
  "nama_panggilan",
  "jenis_kelamin*",
  "tanggal_lahir",
  "tempat_lahir",
  "meninggal",
  "tanggal_meninggal",
  "bio",
  "cabang",
  "level_generasi",
  "telepon",
  "whatsapp",
  "email",
  "alamat",
  "kota",
  "provinsi",
  "kode_pos",
  "status_pernikahan",
  "catatan_keluarga",
] as const;

const RELASI_HEADERS = [
  "ref_orang*",
  "jenis_relasi*",
  "ref_target*",
  "peran",
  "adopsi",
  "tiri",
  "tanggal_menikah",
  "status_pasangan",
] as const;

const AKUN_HEADERS = ["ref_orang*", "email_akun*", "peran"] as const;

const ANGGOTA_WIDTHS = [12, 25, 18, 15, 15, 18, 12, 18, 30, 15, 15, 15, 15, 25, 30, 15, 15, 12, 18, 30];
const RELASI_WIDTHS = [15, 15, 15, 12, 10, 10, 18, 18];
const AKUN_WIDTHS = [15, 30, 18];

/** Kolom dropdown per sheet, memakai indeks 0-based. */
const DROPDOWNS: Record<TemplateSheet, { column: number; options: string[] }[]> = {
  Anggota: [
    { column: 3, options: ["MALE", "FEMALE", "OTHER", "L", "P"] },
    { column: 6, options: ["Ya", "Tidak"] },
    { column: 18, options: ["Belum Menikah", "Menikah", "Cerai", "Janda", "Duda"] },
  ],
  Relasi: [
    { column: 1, options: ["ORANG_TUA", "PASANGAN"] },
    { column: 3, options: ["FATHER", "MOTHER", "UNKNOWN"] },
    { column: 4, options: ["Ya", "Tidak"] },
    { column: 5, options: ["Ya", "Tidak"] },
    { column: 7, options: ["MARRIED", "DIVORCED", "WIDOWED", "UNKNOWN"] },
  ],
  Akun: [{ column: 2, options: ["MEMBER", "BRANCH_ADMIN", "SUPER_ADMIN"] }],
};

function styleHeader(sheet: ExcelJS.Worksheet, argb: string): void {
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

/**
 * Terapkan dropdown list SETELAH baris contoh ditulis.
 * Jika dipasang sebelum `addRow`, rentang validasi ikut bergeser dan
 * dropdown menutupi baris contoh.
 */
function applyDropdowns(sheet: ExcelJS.Worksheet, sheetName: TemplateSheet): void {
  for (const { column, options } of DROPDOWNS[sheetName]) {
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
    "PETUNJUK PENGGUNAAN TEMPLATE IMPOR DATA KELUARGA",
    "",
    "1. Sheet 'Anggota': Data identitas anggota keluarga",
    "   - ref: kode unik anggota (contoh: A001, B002)",
    "   - nama_lengkap: nama lengkap (wajib)",
    "   - jenis_kelamin: L/P atau MALE/FEMALE (wajib)",
    "   - tanggal_lahir: format YYYY-MM-DD atau DD/MM/YYYY",
    "",
    "2. Sheet 'Relasi': Hubungan keluarga",
    "   - jenis_relasi: ORANG_TUA atau PASANGAN",
    "   - ref_orang: ref anak (untuk ORANG_TUA) atau pasangan 1 (untuk PASANGAN)",
    "   - ref_target: ref orang tua (untuk ORANG_TUA) atau pasangan 2 (untuk PASANGAN)",
    "   - peran: FATHER/MOTHER/UNKNOWN (untuk ORANG_TUA)",
    "",
    "3. Sheet 'Akun': Akun login pengguna",
    "   - ref_orang: ref dari sheet Anggota",
    "   - email_akun: email unik untuk login",
    "   - peran: MEMBER/BRANCH_ADMIN/SUPER_ADMIN",
    "   - Password default: WD26 (wajib diganti saat login pertama)",
    "",
    "4. Baris dengan ref/email diawali 'CONTOH' akan diabaikan",
    "5. Maksimal 2 orang tua per anggota",
    "6. Ukuran file maksimal 10MB",
    "",
    "Simpan file ini dan isi sheet Anggota, Relasi, Akun sesuai kebutuhan.",
  ];

  instructions.forEach((line, i) => {
    const cell = petunjuk.getCell(`A${i + 1}`);
    cell.value = line;
    if (i === 0) cell.font = { bold: true, size: 14 };
  });

  // ── Sheet 2: Anggota ────────────────────
  const anggota = workbook.addWorksheet("Anggota");
  anggota.columns = ANGGOTA_HEADERS.map((header, i) => ({ header, key: `c${i}`, width: ANGGOTA_WIDTHS[i] }));
  styleHeader(anggota, "FFE8F4E6");

  anggota.addRow({
    c0: "CONTOH_A001",
    c1: "Tn. Contoh Wirjodihardjo",
    c2: "Contoh",
    c3: "MALE",
    c4: "1950-01-15",
    c5: "Jakarta",
    c8: "Pendiri cabang contoh",
    c10: "0",
  });

  // ── Sheet 3: Relasi ─────────────────────
  const relasi = workbook.addWorksheet("Relasi");
  relasi.columns = RELASI_HEADERS.map((header, i) => ({ header, key: `c${i}`, width: RELASI_WIDTHS[i] }));
  styleHeader(relasi, "FFF4E8E6");

  relasi.addRow({ c0: "CONTOH_A002", c1: "ORANG_TUA", c2: "CONTOH_A001", c3: "FATHER" });

  // ── Sheet 4: Akun ───────────────────────
  const akun = workbook.addWorksheet("Akun");
  akun.columns = AKUN_HEADERS.map((header, i) => ({ header, key: `c${i}`, width: AKUN_WIDTHS[i] }));
  styleHeader(akun, "FFE6F0F4");

  akun.addRow({ c0: "CONTOH_A001", c1: "contoh@wirjodihardjo.id", c2: "MEMBER" });

  // Dropdown dipasang setelah baris contoh agar tidak menggeser rentang validasi.
  applyDropdowns(anggota, "Anggota");
  applyDropdowns(relasi, "Relasi");
  applyDropdowns(akun, "Akun");

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** CSV template dengan header dan baris contoh yang sama seperti sheet XLSX. */
export function generateTemplateCSV(sheet: TemplateSheet): Buffer {
  if (sheet === "Anggota") {
    return Buffer.from(
      stringify([[...ANGGOTA_HEADERS], ["CONTOH_A001", "Tn. Contoh Wirjodihardjo", "Contoh", "MALE", "1950-01-15", "Jakarta", "", "", "Pendiri cabang contoh", "", "0"]], { bom: true }),
      "utf-8",
    );
  }
  if (sheet === "Relasi") {
    return Buffer.from(
      stringify([[...RELASI_HEADERS], ["CONTOH_A002", "ORANG_TUA", "CONTOH_A001", "FATHER"]], { bom: true }),
      "utf-8",
    );
  }
  return Buffer.from(
    stringify([[...AKUN_HEADERS], ["CONTOH_A001", "contoh@wirjodihardjo.id", "MEMBER"]], { bom: true }),
    "utf-8",
  );
}

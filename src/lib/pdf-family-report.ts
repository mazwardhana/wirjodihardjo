// Pembangkit PDF ringkasan keluarga tanpa dependensi eksternal (jsPDF sejenis).
// Menghasilkan PDF 1.4 byte-level yang sah dengan palet "arsip keluarga Jawa"
// (krem parchment, hijau hutan, aksen emas) dan hanya memakai font standar
// Times-Roman sehingga aman untuk karakter Latin.

export type FamilyReport = {
  title: string;
  generatedAt: string;
  totalPeople: number;
  parentChildRelations: number;
  partnerships: number;
  couples: number;
  nodes: number;
  notes?: string[];
};

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 48;

function escapeText(value: string): string {
  // PDF string literal: ganti karakter di luar Latin-1 yang mungkin masuk.
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function hex(r: number, g: number, b: number): string {
  const to = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `${to(r)} ${to(g)} ${to(b)}`;
}

type Line = { text: string; size: number; color: string; gap: number; bold?: boolean };

function buildContentStream(lines: Line[]): string {
  const parts: string[] = [];
  parts.push(`${hex(0xf7 / 1, 0xf1 / 1, 0xe2 / 1)} rg 0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT} re f`);
  // Bingkai luar emas tipis
  parts.push(`0.71 0.53 0.16 RG 1.4 w ${MARGIN - 10} ${MARGIN - 10} ${PAGE_WIDTH - (MARGIN - 10) * 2} ${PAGE_HEIGHT - (MARGIN - 10) * 2} re S`);

  let y = PAGE_HEIGHT - MARGIN - 10;
  for (const line of lines) {
    y -= line.gap;
    if (y < MARGIN) {
      // Halaman baru tidak dibuat di sini; pemangkas isi menjaga agar muat.
      break;
    }
    const r = parseInt(line.color.slice(1, 3), 16) / 255;
    const g = parseInt(line.color.slice(3, 5), 16) / 255;
    const b = parseInt(line.color.slice(5, 7), 16) / 255;
    const font = line.bold ? "F2" : "F1";
    parts.push(`BT ${hex(r * 255, g * 255, b * 255)} rg /${font} ${line.size} Tf 1 0 0 1 ${MARGIN} ${y.toFixed(2)} Tm (${escapeText(line.text)}) Tj ET`);
  }
  return parts.join("\n");
}

function assemblePdf(contentStreams: string[]): Uint8Array {
  const objects: string[] = [];
  // 1 = catalog, 2 = pages, 3.. = page+content pairs, lalu font di akhir.
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";

  const pageObjIds: number[] = [];
  let nextId = 3;
  const pageEntries: Array<{ pageId: number; contentId: number }> = [];
  for (const stream of contentStreams) {
    const pageId = nextId++;
    const contentId = nextId++;
    pageEntries.push({ pageId, contentId });
    objects[contentId] = `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`;
  }
  const fontRegularId = nextId++;
  const fontBoldId = nextId++;
  objects[fontRegularId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>";
  objects[fontBoldId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>";

  for (const { pageId } of pageEntries) {
    pageObjIds.push(pageId);
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      `/Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> ` +
      `/Contents ${pageId + 1} 0 R >>`;
  }

  objects[2] = `<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjIds.length} >>`;

  let out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    if (!objects[id]) continue;
    offsets[id] = Buffer.byteLength(out, "latin1");
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefPos = Buffer.byteLength(out, "latin1");
  const maxId = objects.length - 1;
  out += `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= maxId; id++) {
    const off = offsets[id] ?? 0;
    out += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

  const buf = Buffer.from(out, "latin1");
  const bytes = new Uint8Array(new ArrayBuffer(buf.byteLength));
  bytes.set(buf);
  return bytes as Uint8Array<ArrayBuffer>;
}

const NOTES = [
  "Catatan arsip:",
  "- Angka di atas dihitung dari data silsilah aktif pada basis data.",
  "- Simpul pohon adalah jumlah orang yang menjadi titik pada graf silsilah.",
  "- Dokumen ini dihasilkan otomatis; periksa kembali bila data berubah.",
];

function wrap(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Bangun PDF satu halaman berisi ringkasan keluarga.
 * Mengembalikan byte PDF yang siap diunduh.
 */
export function buildFamilyReportPdf(report: FamilyReport): Uint8Array {
  const generated = new Date(report.generatedAt);
  const tanggal = Number.isNaN(generated.getTime())
    ? report.generatedAt
    : new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(generated);

  const lines: Line[] = [
    { text: report.title, size: 20, color: "#1f3a2b", gap: 8, bold: true },
    { text: "Laporan Silsilah Keluarga", size: 12, color: "#6f4a2b", gap: 24 },
    { text: `Dibuat: ${tanggal}`, size: 10, color: "#5c5040", gap: 30 },
    { text: `Total orang: ${report.totalPeople}`, size: 12, color: "#221a11", gap: 18 },
    { text: `Total relasi: ${report.parentChildRelations + report.partnerships}`, size: 12, color: "#221a11", gap: 18 },
    { text: `Relasi orang tua-anak: ${report.parentChildRelations}`, size: 12, color: "#221a11", gap: 18 },
    { text: `Pasangan tercatat: ${report.partnerships}`, size: 12, color: "#221a11", gap: 18 },
    { text: `Pasangan menikah: ${report.couples}`, size: 12, color: "#221a11", gap: 18 },
    { text: `Simpul pohon: ${report.nodes}`, size: 12, color: "#221a11", gap: 30 },
  ];

  for (const note of NOTES) {
    for (const wrapped of wrap(note, 80)) {
      lines.push({ text: wrapped, size: 10, color: "#5c5040", gap: 15 });
    }
  }
  for (const note of report.notes ?? []) {
    for (const wrapped of wrap(note, 80)) {
      lines.push({ text: wrapped, size: 10, color: "#5c5040", gap: 15 });
    }
  }

  const content = buildContentStream(lines);
  return assemblePdf([content]);
}
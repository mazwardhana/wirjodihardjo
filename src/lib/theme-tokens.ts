// Token warna untuk kode yang tidak bisa membaca CSS custom property:
// manifest PWA (dibuat saat build, di luar DOM) dan skrip pembuat ikon.
// Sumber kebenaran tetap `--color-*` di src/app/globals.css; berkas ini adalah
// salinan runtime-nya. theme-tokens.test.ts menjaga keduanya tidak melenceng.
export const PALET = {
  cream: "#f7f1e2",
  forest: "#1f3a2b",
  gold: "#b4872a",
} as const;

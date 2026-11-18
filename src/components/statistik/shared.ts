/**
 * Komponen bersama halaman statistik publik (/statistik) dan admin
 * (/admin/statistik). Dua halaman ini menampilkan angka yang sama dari
 * lib/statistik, jadi definisi angka dan formatnya dipegang di satu tempat.
 */

/** Format angka gaya Indonesia (pemisah ribuan titik). */
export function angka(n: number): string {
  return new Intl.NumberFormat("id-ID").format(n);
}

/** Waktu lokal tengah malam, supaya selisih hari tidak terseset oleh jam. */
function tengahMalam(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** \\"hari ini\\", \\"kemarin\\", \\"besok\\", atau \\"x hari yang lalu/depan\\". */
export function jarakHari(date: Date, now: Date): string {
  const selisih = Math.round((tengahMalam(date) - tengahMalam(now)) / 86_400_000);
  if (selisih === 0) return "hari ini";
  return new Intl.RelativeTimeFormat("id", { numeric: "auto" }).format(selisih, "day");
}

/** Peringkat cabang dari yang terbesar, seri dipecah lewat nomor cabang. */
export function urutkanCabang<T extends { total: number; branchNumber: number }>(
  branches: T[],
): T[] {
  return [...branches].sort((a, b) => b.total - a.total || a.branchNumber - b.branchNumber);
}

/** Cabang dengan anggota terbanyak (0 bila tidak ada). */
export function cabangTerbesar(branches: { total: number }[]): number {
  return branches.reduce((maks, b) => Math.max(maks, b.total), 0);
}

"use client";

/**
 * Helper murni halaman buku tamu. Dipisah dari BukuTamuClient.tsx supaya bisa
 * diuji dengan `npx tsx --test` tanpa menyentuh React (aturan repo: tes per
 * file dengan node:test, tanpa agregator).
 *
 * Baris buku tamu ada dua bentuk: anggota lama yang dipilih dari hasil
 * pencarian (`existing`) dan tamu baru yang diketik manual (`walkIn`).
 */

export type GuestRow =
  | {
      kind: "existing";
      personId: string;
      fullName: string;
      namaPanggilan: string | null;
      /** Nama keluarga cabang, untuk ditampilkan di ringkasan rombongan. */
      branchName: string | null;
      /** true bila orang ini sudah punya baris pendaftaran reuni. */
      alreadyRegistered: boolean;
      /** true bila sudah lewat buku tamu (checkedInAt terisi). */
      checkedIn: boolean;
    }
  | {
      kind: "walkIn";
      fullName: string;
      namaPanggilan: string;
      gender: "MALE" | "FEMALE" | "OTHER";
    };

export type GroupSummary = {
  total: number;
  existing: number;
  alreadyCheckedIn: number;
  walkIn: number;
};

export function summarizeGroup(rows: GuestRow[]): GroupSummary {
  return {
    total: rows.length,
    existing: rows.filter((r) => r.kind === "existing").length,
    alreadyCheckedIn: rows.filter((r) => r.kind === "existing" && r.checkedIn).length,
    walkIn: rows.filter((r) => r.kind === "walkIn").length,
  };
}

export function isSameRow(a: GuestRow, b: GuestRow): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "existing" && b.kind === "existing") return a.personId === b.personId;
  if (a.kind === "walkIn" && b.kind === "walkIn") {
    return (
      a.fullName.trim().toLowerCase() === b.fullName.trim().toLowerCase() &&
      a.namaPanggilan.trim().toLowerCase() === b.namaPanggilan.trim().toLowerCase()
    );
  }
  return false;
}

/**
 * Kiriman boleh diproses bila ada satu baris valid: tamu baru harus punya
 * nama lengkap dan nama panggilan, anggota lama tidak boleh sudah absen,
 * dan satu orang hanya muncul sekali dalam satu rombongan.
 */
export function canSubmit(rows: GuestRow[]): boolean {
  if (rows.length === 0) return false;
  const seen = new Set<string>();
  for (const row of rows) {
    const key =
      row.kind === "existing"
        ? `p:${row.personId}`
        : `n:${row.fullName.trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    if (row.kind === "existing" && row.checkedIn) return false;
    if (row.kind === "walkIn" && (row.fullName.trim() === "" || row.namaPanggilan.trim() === "")) {
      return false;
    }
  }
  return true;
}

/**
 * Kelompokkan baris menurut cabang tujuan: anggota lama mengikuti cabangnya
 * di basis data, tamu baru ikut cabang yang dipilih tamu di langkah pertama.
 * Nilai kembali hanya berisi cabang yang punya baris.
 */
export function groupRowsByBranch(
  rows: GuestRow[],
  existingBranchId: string | null,
  walkInBranchId: string | null,
): Record<string, GuestRow[]> {
  const groups: Record<string, GuestRow[]> = {};
  for (const row of rows) {
    const branchId = row.kind === "existing" ? existingBranchId : walkInBranchId;
    if (!branchId) continue;
    groups[branchId] ??= [];
    groups[branchId].push(row);
  }
  return groups;
}

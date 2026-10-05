import type { RegistrasiCredential, RegistrasiImportRow } from "./types";

/** Satu baris pratinjau: data mentah berkas + rencana kredensialnya. */
export type RegistrasiPreviewRow = {
  _row?: number;
  cabangKe: string;
  namaPanggilan: string;
  namaLengkap: string;
  gender: string;
  status: string;
  hadir: string;
  username: string;
  /** null bila baris tidak punya rencana kredensial (mis. ber-error). */
  willAttend: boolean | null;
  branchNumber: number | null;
  accountStatus: string;
};

/**
 * Gabungkan baris tervalidasi dengan rencana kredensial untuk pratinjau.
 *
 * `credentials` hanya memuat baris dengan cabang tervalidasi, berurutan
 * mengikuti baris data. Penggabungan dilakukan dengan konsumsi berurutan —
 * bukan indeks mentah — supaya baris ber-error (yang tidak punya kredensial)
 * tidak menggeser kolom username/status baris berikutnya.
 */
export function buildRegistrasiPreview(
  rows: RegistrasiImportRow[],
  credentials: RegistrasiCredential[],
  limit = 100,
): RegistrasiPreviewRow[] {
  const iterator = credentials[Symbol.iterator]();
  return rows.slice(0, limit).map((row) => {
    const credential = row.branchId ? iterator.next().value : undefined;
    return {
      _row: row._row,
      cabangKe: row.cabangKe,
      namaPanggilan: row.namaPanggilan,
      namaLengkap: row.namaLengkap,
      gender: row.gender,
      status: row.status,
      hadir: row.hadir,
      username: credential?.username ?? "",
      willAttend: credential ? credential.willAttend : null,
      branchNumber: credential?.branchNumber ?? row.branchNumber ?? null,
      accountStatus: credential?.status ?? "",
    };
  });
}

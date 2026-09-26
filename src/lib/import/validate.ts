import type {
  ParsedData,
  ValidationError,
  ValidationResult,
  Gender,
  ParentRole,
  PartnerStatus,
  UserRole,
  RelationKind,
} from "./types";

const GENDERS: Gender[] = ["MALE", "FEMALE", "OTHER"];
const PARENT_ROLES: ParentRole[] = ["FATHER", "MOTHER", "UNKNOWN"];
const PARTNER_STATUSES: PartnerStatus[] = ["MARRIED", "DIVORCED", "WIDOWED", "UNKNOWN"];
const USER_ROLES: UserRole[] = ["SUPER_ADMIN", "BRANCH_ADMIN", "MEMBER"];
const MAX_PARENTS = 2;

const GENDER_ALIASES: Record<string, Gender> = {
  l: "MALE",
  "laki-laki": "MALE",
  lakilaki: "MALE",
  lelaki: "MALE",
  pria: "MALE",
  male: "MALE",
  m: "MALE",
  p: "FEMALE",
  perempuan: "FEMALE",
  wanita: "FEMALE",
  female: "FEMALE",
  f: "FEMALE",
  other: "OTHER",
  lainnya: "OTHER",
  lain: "OTHER",
};

const PARENT_ROLE_ALIASES: Record<string, ParentRole> = {
  father: "FATHER",
  ayah: "FATHER",
  bapak: "FATHER",
  mother: "MOTHER",
  ibu: "MOTHER",
  unknown: "UNKNOWN",
  tidak_diketahui: "UNKNOWN",
};

const PARTNER_STATUS_ALIASES: Record<string, PartnerStatus> = {
  married: "MARRIED",
  menikah: "MARRIED",
  kawin: "MARRIED",
  divorced: "DIVORCED",
  cerai: "DIVORCED",
  widowed: "WIDOWED",
  janda: "WIDOWED",
  duda: "WIDOWED",
  unknown: "UNKNOWN",
};

const USER_ROLE_ALIASES: Record<string, UserRole> = {
  super_admin: "SUPER_ADMIN",
  superadmin: "SUPER_ADMIN",
  branch_admin: "BRANCH_ADMIN",
  branchadmin: "BRANCH_ADMIN",
  admin_cabang: "BRANCH_ADMIN",
  admin: "BRANCH_ADMIN",
  member: "MEMBER",
  anggota: "MEMBER",
};

function normalizeGender(value: string | undefined): Gender | null {
  if (!value?.trim()) return null;
  const key = value.trim().toLowerCase();
  const upper = value.trim().toUpperCase();
  if (GENDERS.includes(upper as Gender)) return upper as Gender;
  const alias = key.replace(/\s+/g, "-");
  return Object.prototype.hasOwnProperty.call(GENDER_ALIASES, alias) ? GENDER_ALIASES[alias] : null;
}

function normalizeEnum<T extends string>(
  value: string | undefined,
  allowed: T[],
  aliases: Record<string, T>,
): T | null {
  if (!value?.trim()) return null;
  const upper = value.trim().toUpperCase().replace(/\s+/g, "_");
  if (allowed.includes(upper as T)) return upper as T;
  const key = value.trim().toLowerCase().replace(/\s+/g, "_");
  return Object.prototype.hasOwnProperty.call(aliases, key) ? aliases[key] : null;
}

function normalizeParentRole(value: string | undefined): ParentRole | null {
  return normalizeEnum(value, PARENT_ROLES, PARENT_ROLE_ALIASES);
}

function normalizePartnerStatus(value: string | undefined): PartnerStatus | null {
  return normalizeEnum(value, PARTNER_STATUSES, PARTNER_STATUS_ALIASES);
}

function normalizeUserRole(value: string | undefined): UserRole | null {
  return normalizeEnum(value, USER_ROLES, USER_ROLE_ALIASES);
}

function normalizeRelation(value: string | undefined): RelationKind | null {
  if (!value?.trim()) return null;
  const upper = value.trim().toUpperCase().replace(/\s+/g, "_");
  if (upper === "ORANG_TUA" || upper === "ORANGTUA" || upper === "PARENT") return "ORANG_TUA";
  if (upper === "PASANGAN" || upper === "PARTNER" || upper === "SPOUSE") return "PASANGAN";
  return null;
}

function normalizeBoolean(value: string | undefined): boolean | null {
  if (value === undefined || value.trim() === "") return null;
  const key = value.trim().toLowerCase();
  if (["ya", "yes", "true", "1", "y", "t", "benar"].includes(key)) return true;
  if (["tidak", "no", "false", "0", "n", "salah"].includes(key)) return false;
  return null;
}

/** Tanggal kalender yang ketat: tidak ada rollover, tidak ada fallback longgar. */
function parseStrictDate(value: string | undefined): string | null | "invalid" {
  if (!value || !value.trim()) return null;
  const trimmed = value.trim();
  let year: number, month: number, day: number;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else if (dmy) {
    year = Number(dmy[3]);
    month = Number(dmy[2]);
    day = Number(dmy[1]);
  } else {
    return "invalid";
  }

  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1) return "invalid";
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "invalid";
  }
  return date.toISOString().slice(0, 10);
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function normalizeEmail(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

export function validateImportData(data: ParsedData): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  if (
    data.anggota.length === 0 &&
    data.relasi.length === 0 &&
    data.akun.length === 0
  ) {
    errors.push({
      sheet: "Anggota",
      row: 0,
      field: "ref",
      message: "File impor kosong: tidak ada baris data pada sheet Anggota, Relasi, atau Akun.",
    });
    return { valid: false, errors, warnings, data };
  }

  const refs = new Set<string>();
  const emailRefs = new Set<string>();

  const anggota = data.anggota.map((row, index) => {
    const rowNo = row._row ?? index + 2;
    const ref = row.ref?.trim() ?? "";
    const namaLengkap = row.namaLengkap?.trim() ?? "";
    const gender = normalizeGender(row.jenisKelamin);

    if (!ref) {
      errors.push({ sheet: "Anggota", row: rowNo, field: "ref", message: "Ref wajib diisi." });
    } else if (!/^[A-Za-z0-9_-]+$/.test(ref)) {
      errors.push({
        sheet: "Anggota",
        row: rowNo,
        field: "ref",
        message: "Ref hanya boleh huruf, angka, tanda hubung, dan garis bawah.",
      });
    } else if (refs.has(ref)) {
      errors.push({ sheet: "Anggota", row: rowNo, field: "ref", message: `Ref "${ref}" duplikat.` });
    } else {
      refs.add(ref);
    }

    if (!namaLengkap) {
      errors.push({
        sheet: "Anggota",
        row: rowNo,
        field: "nama_lengkap",
        message: "Nama lengkap wajib diisi.",
      });
    }

    if (!gender) {
      errors.push({
        sheet: "Anggota",
        row: rowNo,
        field: "jenis_kelamin",
        message: "Jenis kelamin harus L/P atau MALE/FEMALE/OTHER.",
      });
    }

    const tanggalLahir = parseStrictDate(row.tanggalLahir);
    if (tanggalLahir === "invalid") {
      errors.push({
        sheet: "Anggota",
        row: rowNo,
        field: "tanggal_lahir",
        message: "Format tanggal lahir tidak valid (YYYY-MM-DD atau DD/MM/YYYY).",
      });
    }

    const tanggalMeninggal = parseStrictDate(row.tanggalMeninggal);
    if (tanggalMeninggal === "invalid") {
      errors.push({
        sheet: "Anggota",
        row: rowNo,
        field: "tanggal_meninggal",
        message: "Format tanggal meninggal tidak valid (YYYY-MM-DD atau DD/MM/YYYY).",
      });
    }

    if (
      tanggalLahir !== "invalid" &&
      tanggalMeninggal !== "invalid" &&
      tanggalLahir &&
      tanggalMeninggal &&
      tanggalMeninggal < tanggalLahir
    ) {
      errors.push({
        sheet: "Anggota",
        row: rowNo,
        field: "tanggal_meninggal",
        message: "Tanggal meninggal tidak boleh lebih awal dari tanggal lahir.",
      });
    }

    const meninggal = normalizeBoolean(row.meninggal);
    if (row.meninggal?.trim() && meninggal === null) {
      errors.push({ sheet: "Anggota", row: rowNo, field: "meninggal", message: "Kolom meninggal harus Ya/Tidak (atau true/false)." });
    }

    const levelGenerasi = row.levelGenerasi?.trim() ?? "";
    if (levelGenerasi && !/^\d+$/.test(levelGenerasi)) {
      errors.push({
        sheet: "Anggota",
        row: rowNo,
        field: "level_generasi",
        message: "Level generasi harus berupa angka.",
      });
    }

    const email = normalizeEmail(row.email);
    if (email) {
      if (!isEmail(email)) {
        errors.push({
          sheet: "Anggota",
          row: rowNo,
          field: "email",
          message: "Format email tidak valid.",
        });
      } else if (emailRefs.has(email)) {
        errors.push({
          sheet: "Anggota",
          row: rowNo,
          field: "email",
          message: `Email "${email}" duplikat.`,
        });
      } else {
        emailRefs.add(email);
      }
    }

    return {
      ...row,
      _row: rowNo,
      ref,
      namaLengkap,
      namaPanggilan: row.namaPanggilan?.trim() || undefined,
      jenisKelamin: gender ?? row.jenisKelamin,
      meninggal: meninggal === null ? undefined : String(meninggal),
      tanggalLahir: tanggalLahir === "invalid" ? row.tanggalLahir : tanggalLahir ?? undefined,
      tanggalMeninggal: tanggalMeninggal === "invalid" ? row.tanggalMeninggal : tanggalMeninggal ?? undefined,
      email: email || undefined,
      levelGenerasi: levelGenerasi || undefined,
    };
  });

  const relasi = data.relasi.map((row, index) => {
    const rowNo = row._row ?? index + 2;
    const kind = normalizeRelation(row.jenisRelasi);
    const refOrang = row.refOrang?.trim() ?? "";
    const refTarget = row.refTarget?.trim() ?? "";

    if (!kind) {
      errors.push({
        sheet: "Relasi",
        row: rowNo,
        field: "jenis_relasi",
        message: "Jenis relasi harus ORANG_TUA atau PASANGAN.",
      });
    }

    if (!refOrang || !refs.has(refOrang)) {
      errors.push({
        sheet: "Relasi",
        row: rowNo,
        field: "ref_orang",
        message: `Ref "${refOrang}" tidak ditemukan di sheet Anggota.`,
      });
    }
    if (!refTarget || !refs.has(refTarget)) {
      errors.push({
        sheet: "Relasi",
        row: rowNo,
        field: "ref_target",
        message: `Ref "${refTarget}" tidak ditemukan di sheet Anggota.`,
      });
    }
    if (refOrang && refTarget && refOrang === refTarget) {
      errors.push({
        sheet: "Relasi",
        row: rowNo,
        field: "ref_target",
        message: "Seseorang tidak dapat berelasi dengan dirinya sendiri.",
      });
    }

    let peranOrangTua = row.peranOrangTua;
    let statusPasangan = row.statusPasangan;
    const adopsi = normalizeBoolean(row.adopsi);
    const tiri = normalizeBoolean(row.tiri);
    const tanggalMenikah = parseStrictDate(row.tanggalMenikah);

    if (row.adopsi !== undefined && row.adopsi.trim() !== "" && adopsi === null) {
      errors.push({
        sheet: "Relasi",
        row: rowNo,
        field: "adopsi",
        message: "Kolom adopsi harus Ya/Tidak (atau true/false).",
      });
    }
    if (row.tiri !== undefined && row.tiri.trim() !== "" && tiri === null) {
      errors.push({
        sheet: "Relasi",
        row: rowNo,
        field: "tiri",
        message: "Kolom tiri harus Ya/Tidak (atau true/false).",
      });
    }

    if (kind === "ORANG_TUA") {
      if (row.peranOrangTua?.trim()) {
        const role = normalizeParentRole(row.peranOrangTua);
        if (!role) {
          errors.push({ sheet: "Relasi", row: rowNo, field: "peran", message: "Peran orang tua harus FATHER, MOTHER, atau UNKNOWN." });
        } else {
          peranOrangTua = role;
        }
      }
    } else if (kind === "PASANGAN") {
      if (row.statusPasangan?.trim()) {
        const status = normalizePartnerStatus(row.statusPasangan);
        if (!status) {
          errors.push({ sheet: "Relasi", row: rowNo, field: "status_pasangan", message: "Status pasangan tidak valid." });
        } else {
          statusPasangan = status;
        }
      }
      if (tanggalMenikah === "invalid") {
        errors.push({ sheet: "Relasi", row: rowNo, field: "tanggal_menikah", message: "Format tanggal menikah tidak valid (YYYY-MM-DD atau DD/MM/YYYY)." });
      }
    }

    return {
      ...row,
      _row: rowNo,
      jenisRelasi: kind ?? row.jenisRelasi,
      refOrang,
      refTarget,
      peranOrangTua,
      statusPasangan,
      adopsi: adopsi === null ? undefined : String(adopsi),
      tiri: tiri === null ? undefined : String(tiri),
      tanggalMenikah: tanggalMenikah === "invalid" ? row.tanggalMenikah : tanggalMenikah ?? undefined,
    };
  });

  // Hitung orang tua unik per anak; baris duplikat tidak dianggap menambah orang tua.
  const uniqueParents = new Map<string, Set<string>>();
  for (const row of relasi) {
    if (normalizeRelation(row.jenisRelasi) !== "ORANG_TUA") continue;
    if (!refs.has(row.refOrang) || !refs.has(row.refTarget)) continue;
    const parents = uniqueParents.get(row.refOrang) ?? new Set<string>();
    parents.add(row.refTarget);
    uniqueParents.set(row.refOrang, parents);
  }
  const seenParentPairs = new Set<string>();
  relasi.forEach((row, index) => {
    if (normalizeRelation(row.jenisRelasi) !== "ORANG_TUA") return;
    const rowNo = row._row ?? index + 2;
    const pair = `${row.refOrang}\u0000${row.refTarget}`;
    if (seenParentPairs.has(pair)) return;
    seenParentPairs.add(pair);
    const count = uniqueParents.get(row.refOrang)?.size ?? 0;
    if (count > MAX_PARENTS) {
      errors.push({
        sheet: "Relasi",
        row: rowNo,
        field: "ref_target",
        message: `Ref "${row.refOrang}" melebihi batas ${MAX_PARENTS} orang tua.`,
      });
    }
  });

  const akun = data.akun.map((row, index) => {
    const rowNo = row._row ?? index + 2;
    const ref = row.ref?.trim() ?? "";
    const email = normalizeEmail(row.email);

    if (!ref || !refs.has(ref)) {
      errors.push({
        sheet: "Akun",
        row: rowNo,
        field: "ref_orang",
        message: `Ref "${ref}" tidak ditemukan di sheet Anggota.`,
      });
    }

    if (!email) {
      errors.push({ sheet: "Akun", row: rowNo, field: "email_akun", message: "Email akun wajib diisi." });
    } else if (!isEmail(email)) {
      errors.push({ sheet: "Akun", row: rowNo, field: "email_akun", message: "Format email tidak valid." });
    }

    let peran = row.peran;
    if (row.peran?.trim()) {
      const role = normalizeUserRole(row.peran);
      if (!role) {
        errors.push({
          sheet: "Akun",
          row: rowNo,
          field: "peran",
          message: "Peran harus SUPER_ADMIN, BRANCH_ADMIN, atau MEMBER.",
        });
      } else {
        peran = role;
      }
    } else {
      peran = "MEMBER";
    }

    return { ...row, _row: rowNo, ref, email, peran: peran as UserRole };
  });

  // Ref akun unik: satu anggota tidak boleh punya lebih dari satu akun.
  const seenAccountRefs = new Set<string>();
  akun.forEach((row, index) => {
    if (!row.ref) return;
    const rowNo = row._row ?? index + 2;
    if (seenAccountRefs.has(row.ref)) {
      errors.push({
        sheet: "Akun",
        row: rowNo,
        field: "ref_orang",
        message: `Ref "${row.ref}" memiliki lebih dari satu akun.`,
      });
    } else {
      seenAccountRefs.add(row.ref);
    }
  });

  // Email akun unik (antar baris Akun).
  const seenAccountEmails = new Set<string>();
  akun.forEach((row, index) => {
    if (!row.email) return;
    const rowNo = row._row ?? index + 2;
    if (seenAccountEmails.has(row.email)) {
      errors.push({
        sheet: "Akun",
        row: rowNo,
        field: "email_akun",
        message: `Email "${row.email}" duplikat di sheet Akun.`,
      });
    } else {
      seenAccountEmails.add(row.email);
    }
  });

  // Deteksi siklus pada graf anak -> orang tua, lengkap dengan nomor baris.
  const parentEdges = new Map<string, { parent: string; row: number }[]>();
  for (const row of relasi) {
    if (normalizeRelation(row.jenisRelasi) !== "ORANG_TUA") continue;
    if (!refs.has(row.refOrang) || !refs.has(row.refTarget)) continue;
    const list = parentEdges.get(row.refOrang) ?? [];
    list.push({ parent: row.refTarget, row: row._row ?? 0 });
    parentEdges.set(row.refOrang, list);
  }

  // Iterative SCC traversal also handles long chains without overflowing the call stack.
  const visited = new Set<string>();
  const order: string[] = [];
  const reversed = new Map<string, string[]>();
  for (const [child, edges] of parentEdges) {
    for (const edge of edges) {
      const children = reversed.get(edge.parent) ?? [];
      children.push(child);
      reversed.set(edge.parent, children);
    }
  }
  for (const root of refs) {
    if (visited.has(root)) continue;
    visited.add(root);
    const stack = [{ node: root, next: 0 }];
    while (stack.length) {
      const frame = stack[stack.length - 1];
      const edges = parentEdges.get(frame.node) ?? [];
      if (frame.next < edges.length) {
        const target = edges[frame.next++].parent;
        if (!visited.has(target)) {
          visited.add(target);
          stack.push({ node: target, next: 0 });
        }
      } else {
        order.push(frame.node);
        stack.pop();
      }
    }
  }
  const component = new Map<string, number>();
  for (const root of order.reverse()) {
    if (component.has(root)) continue;
    const id = component.size;
    const stack = [root];
    component.set(root, id);
    while (stack.length) {
      const node = stack.pop()!;
      for (const target of reversed.get(node) ?? []) {
        if (!component.has(target)) {
          component.set(target, id);
          stack.push(target);
        }
      }
    }
  }
  for (const [child, edges] of parentEdges) {
    for (const edge of edges) {
      if (component.get(child) === component.get(edge.parent)) {
        errors.push({ sheet: "Relasi", row: edge.row, field: "jenis_relasi", message: "Relasi ini membentuk siklus silsilah." });
      }
    }
  }

  if (data.anggota.length === 0) {
    warnings.push("Tidak ada baris Anggota yang terbaca.");
  }
  if (data.akun.length === 0) {
    warnings.push("Tidak ada baris Akun; tidak ada akun baru yang akan dibuat.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    data: { anggota, relasi, akun },
  };
}

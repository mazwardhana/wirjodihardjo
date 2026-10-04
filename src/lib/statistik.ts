import { REUNI_2027_SLUG } from "@/lib/registrasi";

/**
 * Angka statistik keluarga. Fungsi di sini murni: input adalah db, output
 * adalah objek ringkas siap render, supaya halaman publik dan admin memakai
 * definisi angka yang sama persis.
 */

export type BranchStat = {
  id: string;
  name: string;
  slug: string;
  branchNumber: number;
  total: number;
  living: number;
  deceased: number;
};

export type FamilyStats = {
  total: number;
  living: number;
  deceased: number;
  male: number;
  female: number;
  /** Anggota yang belum ditugaskan ke keluarga cabang mana pun. */
  unassigned: number;
  /** Percentang hidup dari total anggota, 0–100 (dibulatkan). */
  livingPercent: number;
};

export type ReunionStats = {
  title: string | null;
  slug: string;
  locationName: string | null;
  startAt: Date | null;
  /** Peserta terdaftar (CONFIRMED + WAITLIST), jumlah orangnya. */
  confirmedPeople: number;
  waitlistPeople: number;
  cancelledPeople: number;
  attendeeCount: number;
  registrationOpen: boolean;
};

export type RegistrationStats = {
  batchCount: number;
  rowsSubmitted: number;
  accountsMade: number;
  attendeesFromForm: number;
  lastSubmittedAt: Date | null;
};

export type CredentialRow = {
  id: string;
  username: string;
  fullName: string;
  branchName: string | null;
  isVerified: boolean;
  createdAt: Date;
};

export type StatisticsBundle = {
  family: FamilyStats;
  branches: BranchStat[];
  reunion: ReunionStats;
  registration: RegistrationStats;
};

/** Baris hasil `person.groupBy`: kunci kelompok + jumlah anggota. */
type GroupRow = {
  branchId?: string | null;
  isDeceased?: boolean;
  _count?: { _all?: number };
};

/** Batas minimum db yang dibutuhkan modul ini — memudahkan pengujian. */
export type StatisticsDb = {
  person: {
    count(args: unknown): Promise<number>;
    groupBy(args: unknown): Promise<GroupRow[]>;
    aggregate(args: unknown): Promise<Record<string, unknown>>;
  };
  branch: {
    findMany(args: unknown): Promise<
      Array<{ id: string; name: string; slug: string; branchNumber: number }>
    >;
  };
  reunion: {
    findUnique(args: unknown): Promise<{
      id: string;
      title: string;
      slug: string;
      locationName: string | null;
      startAt: Date | null;
      status: string;
      capacity: number | null;
      registrationDeadline: Date | null;
    } | null>;
  };
  reunionRegistration: {
    aggregate(args: unknown): Promise<{ _sum: { guestCount: number | null } }>;
    findMany(args: unknown): Promise<
      Array<{ userId: string; guestCount: number; status: string }>
    >;
  };
  registrationBatch: {
    aggregate(args: unknown): Promise<Record<string, unknown>>;
    findFirst(args: unknown): Promise<{ submittedAt: Date } | null>;
  };
};

/**
 * Menyempikan Prisma client ke kontrak data layer.
 *
 * Prisma client memenuhi kontrak ini saat runtime, tapi setiap metodenya
 * generik (`<T extends PersonCountArgs>`) sehingga tipe hasilnya tidak pernah
 * bisa disamakan dengan struktur sempit di atas. Daripada menulis
 * `as unknown as` berulang di tiap halaman, penyempitan dikumpulkan di sini:
 * satu helper, satu alasan, satu tempat.
 *
 *_Type-only_: tidak ada data yang diubah atau disembunyikan oleh helper ini.
 * Jangan pakai untuk membungkus db pada kode yang butuh narrowing karena
 * bentuk datanya memang salah.
 */
export function asStatisticsDb<T extends StatisticsDb = StatisticsDb>(client: unknown): T {
  return client as T;
}

function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

export async function getFamilyStats(db: StatisticsDb): Promise<FamilyStats> {
  const [total, living, deceased, male, female, grouped] = await Promise.all([
    db.person.count({ where: { deletedAt: null } }),
    db.person.count({ where: { deletedAt: null, isDeceased: false } }),
    db.person.count({ where: { deletedAt: null, isDeceased: true } }),
    db.person.count({ where: { deletedAt: null, gender: "MALE" } }),
    db.person.count({ where: { deletedAt: null, gender: "FEMALE" } }),
    db.person.groupBy({
      by: ["branchId", "isDeceased"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
  ]);

  const unassigned = grouped.reduce((sum, g) => {
    if (g.branchId !== null) return sum;
    return sum + Number(g._count?._all ?? 0);
  }, 0);

  return {
    total,
    living,
    deceased,
    male,
    female,
    unassigned,
    livingPercent: percent(living, total),
  };
}

export async function getBranchStats(db: StatisticsDb): Promise<BranchStat[]> {
  const [branches, grouped] = await Promise.all([
    db.branch.findMany({
      orderBy: { branchNumber: "asc" },
      select: { id: true, name: true, slug: true, branchNumber: true },
    }),
    db.person.groupBy({
      by: ["branchId", "isDeceased"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
  ]);

  return branches.map((branch) => {
    let total = 0;
    let living = 0;
    let deceased = 0;
    for (const g of grouped) {
      if (g.branchId !== branch.id) continue;
      const n = Number(g._count?._all ?? 0);
      total += n;
      if (g.isDeceased === true) deceased += n;
      else living += n;
    }
    return { ...branch, total, living, deceased };
  });
}

export async function getReunionStats(db: StatisticsDb): Promise<ReunionStats> {
  const reunion = await db.reunion.findUnique({ where: { slug: REUNI_2027_SLUG } });
  if (!reunion) {
    return {
      title: null,
      slug: REUNI_2027_SLUG,
      locationName: null,
      startAt: null,
      confirmedPeople: 0,
      waitlistPeople: 0,
      cancelledPeople: 0,
      attendeeCount: 0,
      registrationOpen: false,
    };
  }

  const [confirmed, waitlist, cancelled] = await Promise.all([
    db.reunionRegistration.aggregate({
      where: { reunionId: reunion.id, status: "CONFIRMED" },
      _sum: { guestCount: true },
    }),
    db.reunionRegistration.aggregate({
      where: { reunionId: reunion.id, status: "WAITLIST" },
      _sum: { guestCount: true },
    }),
    db.reunionRegistration.aggregate({
      where: { reunionId: reunion.id, status: "CANCELLED" },
      _sum: { guestCount: true },
    }),
  ]);

  const confirmedPeople = confirmed._sum.guestCount ?? 0;
  const waitlistPeople = waitlist._sum.guestCount ?? 0;
  const now = new Date();
  const deadlinePassed =
    reunion.registrationDeadline !== null && new Date(reunion.registrationDeadline) < now;
  // Selama jadwal belum ditetapkan, pendaftaran tetap dibuka.
  const registrationOpen =
    reunion.status === "PUBLISHED" &&
    (reunion.startAt === null || new Date(reunion.startAt) > now) &&
    !deadlinePassed &&
    (reunion.capacity === null || confirmedPeople + waitlistPeople < reunion.capacity);

  return {
    title: reunion.title,
    slug: reunion.slug,
    locationName: reunion.locationName,
    startAt: reunion.startAt,
    confirmedPeople,
    waitlistPeople,
    cancelledPeople: cancelled._sum.guestCount ?? 0,
    attendeeCount: confirmedPeople + waitlistPeople,
    registrationOpen,
  };
}

export async function getRegistrationStats(db: StatisticsDb): Promise<RegistrationStats> {
  const [aggregate, last] = await Promise.all([
    db.registrationBatch.aggregate({
      _count: { _all: true },
      _sum: { rowCount: true, accountsMade: true, attendees: true },
    }),
    db.registrationBatch.findFirst({ orderBy: { submittedAt: "desc" } }),
  ]);

  const count = aggregate._count as { _all?: number } | undefined;
  const sum = aggregate._sum as
    | { rowCount?: number | null; accountsMade?: number | null; attendees?: number | null }
    | undefined;

  return {
    batchCount: count?._all ?? 0,
    rowsSubmitted: sum?.rowCount ?? 0,
    accountsMade: sum?.accountsMade ?? 0,
    attendeesFromForm: sum?.attendees ?? 0,
    lastSubmittedAt: last?.submittedAt ?? null,
  };
}

export async function getStatistics(db: StatisticsDb): Promise<StatisticsBundle> {
  const [family, branches, reunion, registration] = await Promise.all([
    getFamilyStats(db),
    getBranchStats(db),
    getReunionStats(db),
    getRegistrationStats(db),
  ]);
  return { family, branches, reunion, registration };
}

/**
 * Bentuk db yang dibutuhkan laporan kredensial. Sengaja terpisah dari
 * `StatisticsDb` agar halaman admin bisa menarik hanya tabel `user`.
 */
export type CredentialDb = {
  user: {
    findMany(args: unknown): Promise<CredentialRow[]>;
  };
};

/**
 * Daftar akun yang dibuat lewat form publik, lengkap dengan nama pemiliknya.
 * Dipakai laporan admin untuk membagikan kredensial awal ke pemilik akun.
 */
export async function getRegistrationCredentials(
  db: CredentialDb,
  options: { take?: number } = {},
): Promise<CredentialRow[]> {
  const rows = await db.user.findMany({
    where: { role: "MEMBER", mustChangeCredentials: true },
    orderBy: { createdAt: "desc" },
    take: options.take ?? 200,
    select: {
      id: true,
      username: true,
      isVerified: true,
      createdAt: true,
      person: { select: { fullName: true, branch: { select: { name: true } } } },
    },
  });

  return rows.map((row) => {
    const person = (row as unknown as {
      person: { fullName: string; branch: { name: string } | null } | null;
    }).person;
    return {
      id: row.id,
      username: row.username,
      fullName: person?.fullName ?? "(tanpa profil)",
      branchName: person?.branch?.name ?? null,
      isVerified: row.isVerified,
      createdAt: row.createdAt,
    };
  });
}
import { prisma } from "@/lib/prisma";

/**
 * Lapisan akses data publik.
 * Aturan keras: fungsi di file ini TIDAK PERNAH menyentuh tabel PersonPrivate.
 * Data sensitif hanya boleh diambil lewat query ber-autentikasi (lihat auth-guard).
 */

export type PublicPerson = {
  id: string;
  fullName: string;
  nickname: string | null;
  gender: string;
  birthDate: Date | null;
  birthPlace: string | null;
  isDeceased: boolean;
  bio: string | null;
  photoUrl: string | null;
  generationLevel: number | null;
  branch: { id: string; name: string; slug: string } | null;
};

const publicPersonSelect = {
  id: true,
  fullName: true,
  nickname: true,
  gender: true,
  birthDate: true,
  birthPlace: true,
  isDeceased: true,
  bio: true,
  photoUrl: true,
  generationLevel: true,
  branch: { select: { id: true, name: true, slug: true } },
} as const;

export async function getFounders() {
  return prisma.person.findMany({
    where: { generationLevel: 0 },
    select: publicPersonSelect,
    orderBy: { fullName: "asc" },
  });
}

export async function getBranches() {
  return prisma.branch.findMany({
    orderBy: { orderIndex: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      coverImageUrl: true,
      orderIndex: true,
      rootPerson: {
        select: { id: true, fullName: true, photoUrl: true, gender: true },
      },
      _count: { select: { members: true } },
    },
  });
}

export async function getGenerationBreakdown() {
  const rows = await prisma.person.groupBy({
    by: ["generationLevel"],
    _count: { _all: true },
  });
  return rows
    .map((r) => ({ level: r.generationLevel, count: r._count._all }))
    .sort((a, b) => (a.level ?? 999) - (b.level ?? 999));
}

export async function getPersonCount() {
  return prisma.person.count();
}

/**
 * Ambil data pohon lengkap untuk halaman silsilah.
 * Hanya field publik. Relasi diambil dari edge parent-child dan partner.
 */
export async function getFamilyTree(filters?: {
  branchId?: string;
  generationLevel?: number;
  isDeceased?: boolean;
}) {
  const where: Record<string, unknown> = {};
  if (filters?.branchId) where.branchId = filters.branchId;
  if (filters?.generationLevel !== undefined) where.generationLevel = filters.generationLevel;
  if (filters?.isDeceased !== undefined) where.isDeceased = filters.isDeceased;

  const [persons, childEdges, partnerEdges] = await Promise.all([
    prisma.person.findMany({
      where: where as any,
      select: publicPersonSelect,
      orderBy: { generationLevel: "asc" },
    }),
    prisma.personChild.findMany({
      select: { parentId: true, childId: true, parentRole: true, isStep: true, isAdopted: true },
    }),
    prisma.personPartner.findMany({
      select: { partnerAId: true, partnerBId: true, status: true, marriageDate: true, divorceDate: true, orderIndex: true },
    }),
  ]);

  return { persons, childEdges, partnerEdges };
}

/**
 * Pencarian orang berdasarkan nama lengkap atau nama panggilan.
 * Hanya mengembalikan field publik.
 */
export async function searchPersons(query: string, limit = 20) {
  const q = query.trim();
  if (!q) return [];

  return prisma.person.findMany({
    where: {
      OR: [
        { fullName: { contains: q, mode: "insensitive" } },
        { nickname: { contains: q, mode: "insensitive" } },
      ],
    },
    select: publicPersonSelect,
    take: limit,
    orderBy: { fullName: "asc" },
  });
}

export async function getPersonBySlug(id: string) {
  return prisma.person.findUnique({
    where: { id },
    select: publicPersonSelect,
  });
}
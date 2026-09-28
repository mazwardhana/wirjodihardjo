import { prisma } from "@/lib/prisma";
import { requireAdminScope } from "@/lib/rbac";
import { resolveKeluargaBranch } from "./scope";

export type MemberFilters = {
  gender?: string | null;
  generation?: string | null;
  status?: string | null;
  q?: string | null;
};

export type KeluargaMember = {
  id: string;
  fullName: string;
  nickname: string | null;
  gender: string;
  birthDate: string | null;
  deathDate: string | null;
  birthPlace: string | null;
  isDeceased: boolean;
  generationLevel: number | null;
  city: string | null;
  phone: string | null;
  whatsapp: string | null;
  addressLine: string | null;
};

/**
 * Susun where clause filter tabel anggota keluarga.
 * Selalu berbasis satu cabang dan mengabaikan yang terhapus (soft-delete).
 */
export function buildMemberWhere(branchId: string, filters: MemberFilters = {}) {
  const where: Record<string, unknown> = { branchId, deletedAt: null };

  if (filters.gender === "male") where.gender = "MALE";
  else if (filters.gender === "female") where.gender = "FEMALE";

  if (filters.generation === "unassigned") where.generationLevel = null;
  else if (filters.generation) {
    const level = Number(filters.generation);
    if (Number.isInteger(level) && level >= 0) where.generationLevel = level;
  }

  if (filters.status === "alive") where.isDeceased = false;
  else if (filters.status === "deceased") where.isDeceased = true;

  const q = filters.q?.trim();
  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { nickname: { contains: q, mode: "insensitive" } },
    ];
  }

  return where;
}

type MembersBoundary = {
  user: {
    findUnique(args: {
      where: { id: string };
      select: { role: true; branchAdminOf: { select: { id: true } } };
    }): Promise<{ role: string; branchAdminOf: { id: string } | null } | null>;
  };
  person: {
    findMany(args: {
      where: Record<string, unknown>;
      orderBy: { fullName: "asc" };
      select: Record<string, unknown>;
    }): Promise<
      Array<{
        id: string;
        fullName: string;
        nickname: string | null;
        gender: string;
        birthDate: Date | null;
        deathDate: Date | null;
        birthPlace: string | null;
        isDeceased: boolean;
        generationLevel: number | null;
        private: {
          city: string | null;
          phone: string | null;
          whatsapp: string | null;
          addressLine: string | null;
        } | null;
      }>
    >;
  };
};

export async function getKeluargaMembers(
  userId: string,
  requestedBranchId: string | null | undefined,
  filters: MemberFilters = {},
  db: MembersBoundary = prisma as unknown as MembersBoundary,
): Promise<{ branchId: string; members: KeluargaMember[] }> {
  const scope = await requireAdminScope(userId, db as never);
  const branchId = resolveKeluargaBranch(scope, requestedBranchId);

  const rows = await db.person.findMany({
    where: buildMemberWhere(branchId, filters),
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      nickname: true,
      gender: true,
      birthDate: true,
      deathDate: true,
      birthPlace: true,
      isDeceased: true,
      generationLevel: true,
      private: {
        select: { city: true, phone: true, whatsapp: true, addressLine: true },
      },
    },
  });

  return {
    branchId,
    members: rows.map((row) => ({
      id: row.id,
      fullName: row.fullName,
      nickname: row.nickname,
      gender: row.gender,
      birthDate: row.birthDate ? row.birthDate.toISOString() : null,
      deathDate: row.deathDate ? row.deathDate.toISOString() : null,
      birthPlace: row.birthPlace,
      isDeceased: row.isDeceased,
      generationLevel: row.generationLevel,
      city: row.private?.city ?? null,
      phone: row.private?.phone ?? null,
      whatsapp: row.private?.whatsapp ?? null,
      addressLine: row.private?.addressLine ?? null,
    })),
  };
}

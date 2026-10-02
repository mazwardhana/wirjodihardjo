// Server-only. Logika penautan otomatis anak <-> pasangan, dapat diuji dengan
// klien basis data palsu (lihat pola yang sama di src/lib/child-order.ts).

export const MAX_PARENTS = 2;

export type ChildRow = {
  parentId: string;
  childId: string;
  parentRole: string;
  orderIndex: number;
};

export type PartnerRow = { partnerAId: string; partnerBId: string; status: string };

export type RelationSyncDb = {
  personChild: {
    findMany(args: unknown): Promise<ChildRow[]>;
    create(args: unknown): Promise<unknown>;
  };
  personPartner: {
    findMany(args: unknown): Promise<PartnerRow[]>;
  };
};

export type ParentRoleValue = "FATHER" | "MOTHER" | "UNKNOWN";

/** Pasangan tunggal seseorang, atau null bila tidak ada / lebih dari satu. */
export async function solePartnerId(personId: string, db: RelationSyncDb): Promise<string | null> {
  const partners = await db.personPartner.findMany({
    where: { OR: [{ partnerAId: personId }, { partnerBId: personId }] },
  });
  if (partners.length !== 1) return null;
  const p = partners[0];
  return p.partnerAId === personId ? p.partnerBId : p.partnerAId;
}

/**
 * Setelah anak ditautkan ke `parentId`, tautkan juga ke pasangan tunggal
 * `parentId` (bila ada tepat satu, belum jadi orang tua anak itu, dan anak
 * masih punya < MAX_PARENTS orang tua).
 */
export async function autoLinkChildToPartner(
  childId: string,
  parentId: string,
  partnerRole: ParentRoleValue,
  db: RelationSyncDb,
): Promise<{ linkedPartnerId: string | null }> {
  const partnerId = await solePartnerId(parentId, db);
  if (!partnerId || partnerId === childId) return { linkedPartnerId: null };

  const rows = await db.personChild.findMany({ where: { childId } });
  if (rows.some((r) => r.parentId === partnerId)) return { linkedPartnerId: null };
  if (rows.length >= MAX_PARENTS) return { linkedPartnerId: null };

  await db.personChild.create({
    data: {
      parentId: partnerId,
      childId,
      parentRole: partnerRole,
      orderIndex: rows[0]?.orderIndex ?? 0,
    },
  });
  return { linkedPartnerId: partnerId };
}

/**
 * Saat pasangan baru `partnerId` ditambahkan ke `personId`, tautkan anak-anak
 * `personId` yang masih berorang-tua tunggal (hanya `personId`) ke pasangan itu.
 */
export async function autoLinkChildrenToPartner(
  personId: string,
  partnerId: string,
  partnerRole: ParentRoleValue,
  db: RelationSyncDb,
): Promise<{ linkedChildIds: string[] }> {
  const ownRows = await db.personChild.findMany({ where: { parentId: personId } });
  const candidateIds = [...new Set(ownRows.map((r) => r.childId))];
  if (candidateIds.length === 0) return { linkedChildIds: [] };

  const allRows = await db.personChild.findMany({
    where: { childId: { in: candidateIds } },
  });

  const byChild = new Map<string, ChildRow[]>();
  for (const row of allRows) {
    const arr = byChild.get(row.childId) ?? [];
    arr.push(row);
    byChild.set(row.childId, arr);
  }

  const linkedChildIds: string[] = [];
  for (const childId of candidateIds) {
    const rows = byChild.get(childId) ?? [];
    if (rows.length !== 1) continue; // sudah punya dua orang tua
    if (rows[0].parentId !== personId) continue;
    if (rows.some((r) => r.parentId === partnerId)) continue;
    await db.personChild.create({
      data: {
        parentId: partnerId,
        childId,
        parentRole: partnerRole,
        orderIndex: rows[0].orderIndex,
      },
    });
    linkedChildIds.push(childId);
  }
  return { linkedChildIds };
}

/** Peran orang tua dari jenis kelamin, untuk penautan otomatis. */
export function partnerRoleFromGender(gender: string): ParentRoleValue {
  if (gender === "MALE") return "FATHER";
  if (gender === "FEMALE") return "MOTHER";
  return "UNKNOWN";
}

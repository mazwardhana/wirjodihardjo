// Server-only. Modul ini memakai `@/lib/prisma` sebagai default, sehingga
// pemanggil API cukup memanggil fungsinya tanpa menyuntikkan basis data.
// Tes memakai `ChildOrderDb` palsu agar tidak menyentuh basis data nyata.

import { prisma } from "@/lib/prisma";

/** Kunci grup saudara: himpunan orang tua yang sama, urut abjad, tanpa duplikat. */
export function siblingGroupKey(parentIds: string[]): string {
  return [...new Set(parentIds)].sort().join("|");
}

export type ChildOrderDb = {
  personChild: {
    findMany(
      args: unknown,
    ): Promise<Array<{ childId: string; parentId: string; orderIndex: number }>>;
    update(args: unknown): Promise<unknown>;
  };
};

function resolveDb(db?: ChildOrderDb): ChildOrderDb {
  return db ?? (prisma as unknown as ChildOrderDb);
}

/** Anggota grup saudara dari himpunan orang tua, terurut naik lalu id. */
export async function siblingsOfGroup(
  parentIds: string[],
  db?: ChildOrderDb,
): Promise<Array<{ childId: string; orderIndex: number }>> {
  const client = resolveDb(db);
  const groupKey = siblingGroupKey(parentIds);

  const rows = await client.personChild.findMany({
    where: { parentId: { in: parentIds } },
    select: { childId: true, parentId: true, orderIndex: true },
  });

  // Kumpulkan himpunan orang tua tiap anak, lalu simpan nomor terbesarnya.
  const parentsByChild = new Map<string, Set<string>>();
  const orderByChild = new Map<string, number>();

  for (const row of rows) {
    const parents = parentsByChild.get(row.childId) ?? new Set<string>();
    parents.add(row.parentId);
    parentsByChild.set(row.childId, parents);

    const current = orderByChild.get(row.childId);
    if (current === undefined || row.orderIndex > current) {
      orderByChild.set(row.childId, row.orderIndex);
    }
  }

  return [...parentsByChild.entries()]
    .filter(([, parents]) => siblingGroupKey([...parents]) === groupKey)
    .map(([childId]) => ({ childId, orderIndex: orderByChild.get(childId) ?? 0 }))
    .sort((a, b) => a.orderIndex - b.orderIndex || compareIds(a.childId, b.childId));
}

/** Pemecah seri deterministik untuk id anak (naik). */
function compareIds(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Nomor urut berikutnya untuk anak baru di grup ini. Kosong -> 0. */
export async function nextChildOrderIndex(
  parentIds: string[],
  db?: ChildOrderDb,
): Promise<number> {
  const siblings = await siblingsOfGroup(parentIds, db);
  if (siblings.length === 0) return 0;
  return Math.max(...siblings.map((sibling) => sibling.orderIndex)) + 1;
}

/**
 * Tukar posisi anak dengan tetangganya dalam grup, lalu sinkronkan
 * SELURUH baris PersonChild milik kedua anak (ayah dan ibu).
 * `direction` "up" menukar dengan tetangga sebelumnya, "down" dengan sesudahnya.
 * Mengembalikan false bila anak tidak ada atau sudah di ujung.
 */
export async function moveChild(
  childId: string,
  direction: "up" | "down",
  db?: ChildOrderDb,
): Promise<boolean> {
  const client = resolveDb(db);

  // 1. Himpunan orang tua anak dari seluruh barisnya.
  const ownRows = await client.personChild.findMany({
    where: { childId },
    select: { childId: true, parentId: true, orderIndex: true },
  });
  if (ownRows.length === 0) return false;

  const parentIds = [...new Set(ownRows.map((row) => row.parentId))];

  // 2. Anggota grup saudara yang sudah terurut.
  const siblings = await siblingsOfGroup(parentIds, client);
  const index = siblings.findIndex((sibling) => sibling.childId === childId);
  if (index === -1) return false;

  // 3. Anak di ujung tidak bisa digeser.
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= siblings.length) return false;

  const current = siblings[index].orderIndex;
  const neighbor = siblings[targetIndex].orderIndex;
  const targetChildId = siblings[targetIndex].childId;

  // 4. Tukar nomor. Bila kedua nomor sama, pakai nomor unik bersebelahan
  //    supaya tidak ada dua anak bernomor sama dalam satu grup.
  let childNewOrder = neighbor;
  const neighborNewOrder = current;
  if (childNewOrder === neighborNewOrder) {
    childNewOrder = direction === "up" ? current - 1 : current + 1;
  }

  // 5. Tulis ulang ke SELURUH baris milik kedua anak (ayah dan ibu).
  const rowsToSync = await client.personChild.findMany({
    where: { childId: { in: [childId, targetChildId] } },
    select: { childId: true, parentId: true, orderIndex: true },
  });

  for (const row of rowsToSync) {
    const orderIndex = row.childId === childId ? childNewOrder : neighborNewOrder;
    await client.personChild.update({
      where: { parentId_childId: { parentId: row.parentId, childId: row.childId } },
      data: { orderIndex },
    });
  }

  return true;
}

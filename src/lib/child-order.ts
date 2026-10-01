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

/** Klien Prisma dengan `$transaction` untuk membungkus baca-lalu-tulis. */
type ChildOrderPrisma = ChildOrderDb & {
  $transaction<T>(fn: (tx: ChildOrderDb) => Promise<T>): Promise<T>;
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

  // 1. Kandidat: anak yang punya salah satu orang tua di grup ini.
  const candidates = await client.personChild.findMany({
    where: { parentId: { in: parentIds } },
    select: { childId: true },
  });
  const candidateIds = [...new Set(candidates.map((row) => row.childId))];
  if (candidateIds.length === 0) return [];

  // 2. Ambil SEMUA baris anak-anak kandidat, supaya himpunan orang tua tiap
  //    anak terlihat lengkap. Tanpa langkah ini, anak dengan orang tua
  //    tambahan di luar `parentIds` hanya terlihat sebagian dan lolos filter.
  const rows = await client.personChild.findMany({
    where: { childId: { in: candidateIds } },
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
 * Nomor urut untuk seorang anak di dalam grup saudaranya, dihitung dari
 * himpunan orang tua LENGKAP anak itu. Bila anak sudah punya nomor
 * (orderIndex) di grup tersebut, nomor itu dipertahankan. Bila belum,
 * memakai nextChildOrderIndex dari grup itu.
 */
export async function orderIndexForChild(
  childId: string,
  parentIds: string[],
  db?: ChildOrderDb,
): Promise<number> {
  const siblings = await siblingsOfGroup(parentIds, db);
  const existing = siblings.find((sibling) => sibling.childId === childId);
  if (existing) return existing.orderIndex;
  return nextChildOrderIndex(parentIds, db);
}

/**
 * Menyamakan nomor urut SELURUH baris PersonChild milik satu anak.
 * Dipakai setelah himpunan orang tua anak berubah supaya baris ayah dan ibu
 * selalu bernilai sama.
 */
export async function setChildOrderIndex(
  childId: string,
  orderIndex: number,
  db?: ChildOrderDb,
): Promise<void> {
  const client = resolveDb(db);

  const rows = await client.personChild.findMany({
    where: { childId },
    select: { childId: true, parentId: true, orderIndex: true },
  });

  for (const row of rows) {
    if (row.orderIndex === orderIndex) continue;
    await client.personChild.update({
      where: { parentId_childId: { parentId: row.parentId, childId: row.childId } },
      data: { orderIndex },
    });
  }
}

/**
 * Inti tukar posisi. Menerima klien (prisma atau tx) supaya pemanggil publik
 * dapat membungkus seluruh baca-lalu-tulis dalam satu transaksi.
 */
async function moveChildWith(
  client: ChildOrderDb,
  childId: string,
  direction: "up" | "down",
): Promise<boolean> {
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

/**
 * Tukar posisi anak dengan tetangganya dalam grup, lalu sinkronkan
 * SELURUH baris PersonChild milik kedua anak (ayah dan ibu).
 * `direction` "up" menukar dengan tetangga sebelumnya, "down" dengan sesudahnya.
 * Mengembalikan false bila anak tidak ada atau sudah di ujung.
 *
 * Bila `db` tidak disuntikkan, seluruh baca-lalu-tulis dibungkus satu transaksi
 * Prisma. Bila `db` disuntikkan (tes), pakai klien itu apa adanya.
 */
export async function moveChild(
  childId: string,
  direction: "up" | "down",
  db?: ChildOrderDb,
): Promise<boolean> {
  if (db) return moveChildWith(db, childId, direction);
  return (prisma as unknown as ChildOrderPrisma).$transaction((tx) =>
    moveChildWith(tx, childId, direction),
  );
}

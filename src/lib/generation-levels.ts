/**
 * Perhitungan murni `generationLevel` dari graf relasi orang tua-anak.
 *
 * Aturan dipakai berturut-turut:
 * 1. Punya orang tua -> 1 + max(generationLevel para orang tua).
 * 2. Tanpa orang tua, tetapi akar cabang -> 1.
 * 3. Tanpa orang tua, punya anak -> max(0, min(level anak) - 1), dihitung
 *    pada fase kedua setelah seluruh graf terisi.
 * 4. Tanpa orang tua, tanpa anak, bukan akar cabang -> null.
 *
 * Fungsi ini tidak menyentuh Prisma supaya bisa diuji tanpa basis data.
 */

export type GenerationEdge = { parentId: string; childId: string };

export type ComputeGenerationInput = {
  personIds: string[];
  edges: GenerationEdge[];
  branchRootIds: string[];
};

export function computeGenerationLevels(
  input: ComputeGenerationInput,
): Map<string, number | null> {
  const { personIds, edges, branchRootIds } = input;

  const known = new Set(personIds);
  const parentsOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  const indegree = new Map<string, number>();

  for (const id of personIds) {
    parentsOf.set(id, []);
    childrenOf.set(id, []);
    indegree.set(id, 0);
  }

  // Edge yang menunjuk node di luar daftar diabaikan supaya hasilnya tertutup
  // untuk `personIds` dan pemanggil tidak perlu menyaring lagi.
  for (const edge of edges) {
    if (!known.has(edge.parentId) || !known.has(edge.childId)) continue;
    childrenOf.get(edge.parentId)!.push(edge.childId);
    parentsOf.get(edge.childId)!.push(edge.parentId);
    indegree.set(edge.childId, (indegree.get(edge.childId) ?? 0) + 1);
  }

  const rootIds = new Set(branchRootIds);
  const levels = new Map<string, number | null>();
  const queue: string[] = [];

  // Kahn: mulai dari node tanpa orang tua, agar orang tua selalu diproses
  // sebelum anaknya.
  for (const id of personIds) {
    if ((indegree.get(id) ?? 0) === 0) queue.push(id);
  }

  let cursor = 0;
  while (cursor < queue.length) {
    const id = queue[cursor++];
    if (levels.has(id)) continue;

    const parents = parentsOf.get(id) ?? [];
    if (parents.length > 0) {
      let best = 0;
      for (const parentId of parents) {
        const parentLevel = levels.get(parentId);
        if (typeof parentLevel === "number") best = Math.max(best, parentLevel);
      }
      levels.set(id, 1 + best);
    } else if (rootIds.has(id)) {
      levels.set(id, 1);
    } else if ((childrenOf.get(id)?.length ?? 0) > 0) {
      levels.set(id, 0);
    } else {
      levels.set(id, null);
    }

    for (const childId of childrenOf.get(id) ?? []) {
      const left = (indegree.get(childId) ?? 0) - 1;
      indegree.set(childId, left);
      if (left === 0 && !levels.has(childId)) queue.push(childId);
    }
  }

  // Node yang tersisa (anggota siklus atau keturunannya) tidak pernah selesai
  // secara topologis, jadi diberi null alih-alih menggantung.
  for (const id of personIds) {
    if (!levels.has(id)) levels.set(id, null);
  }

  // Fase kedua: akar tanpa orang tua yang bukan akar cabang tidak otomatis
  // pendiri. Dengan `min(anak) - 1` seorang leluhur yang baru dibuat jatuh
  // tepat di atas anaknya, bukan di 0. Fase ini hanya menaikkan, tidak pernah
  // menurunkan, dan tidak berkaskade karena sebuah akar tidak pernah punya
  // orang tua.
  for (const id of personIds) {
    if ((parentsOf.get(id)?.length ?? 0) > 0) continue;
    if (rootIds.has(id)) continue;
    const childIds = childrenOf.get(id) ?? [];
    if (childIds.length === 0) continue;

    let lowestChildLevel = Number.POSITIVE_INFINITY;
    for (const childId of childIds) {
      const childLevel = levels.get(childId);
      if (typeof childLevel !== "number") continue;
      if (childLevel < lowestChildLevel) lowestChildLevel = childLevel;
    }
    if (lowestChildLevel === Number.POSITIVE_INFINITY) continue;

    levels.set(id, Math.max(0, lowestChildLevel - 1));
  }

  return levels;
}

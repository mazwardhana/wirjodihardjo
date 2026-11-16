/**
 * kalkulator relasi / sapaan kekerabatan otomatis.
 *
 * Modul MURNI (tanpa Prisma / I/O) sehingga dapat diuji tanpa basis data.
 * Algoritma: lowest common ancestor (LCA) pada graf orang tua → anak, lalu
 * pemetaan ke aturan sapaan Indonesia + istilah Jawa.
 *
 * Batasan yang dicatat (AC opsional: adopsi/pernikahan silang):
 * - Edge `isStep = true` DIKECUALIKAN dari graf LCA (saudara/parent tiri
 *   tidak dihitung sebagai relasi darah untuk sapaan kekerabatan).
 * - Edge `isAdopted = true` TETAP diikutsertakan (anak angkat adalah
 *   kerabat). Namun label sapaan untuk orang angkat dipetakan sama seperti
 *   anak kandung (tidak dibedakan pada level LCA ini).
 * - Relasi melalui pernikahan (pasangan) ditangani hanya untuk pasangan
 *   langsung: suami/istri. Pernikahan silang di luar pasangan langsung tidak
 *   diperhitungkan (dicatat sebagai batasan).
 * - Graf tidak harus berupa pohon murni; LCA bekerja pada DAG (orang tua
 *   bisa lebih dari satu). Bila ada beberapa LCA, dipilih yang terdekat
 *   (total jarak terkecil).
 */

import { getAncestorLabel } from "@/lib/generations";

/** Informasi minimal seseorang yang diperlukan kalkulator. */
export type KinshipPerson = {
  id: string;
  fullName: string;
  gender: string; // "MALE" | "FEMALE" | "OTHER"
  birthDate: Date | string | null;
};

/** Satu sisi relasi orang tua → anak. */
export type KinshipParentEdge = {
  parentId: string;
  childId: string;
  isStep: boolean;
  isAdopted: boolean;
};

/** Satu pasangan (pernikahan). */
export type KinshipPartnerEdge = {
  partnerAId: string;
  partnerBId: string;
};

export type KinshipContext = {
  persons: KinshipPerson[];
  parentEdges: KinshipParentEdge[];
  partnerEdges: KinshipPartnerEdge[];
};

/** Hasil relasi: bagaimana A melihat B, dan sebaliknya. */
export type KinshipResult = {
  /** Kode relasi mesin, mis. "UNCLE", "COUSIN", "FATHER". */
  kind: string;
  /** Label sapaan A terhadap B, mis. "Paman (Pakdhe)". */
  label: string;
  /** Label sapaan B terhadap A (kebalikan). */
  reverseLabel: string;
  /** Penjelasan singkat. */
  description: string;
  /** Penjelasan singkat dari arah sebaliknya. */
  reverseDescription: string;
};

function buildGraph(ctx: KinshipContext) {
  const personById = new Map<string, KinshipPerson>();
  for (const p of ctx.persons) personById.set(p.id, p);

  /** childId -> parentId[] (tanpa edge step). */
  const parentsOf = new Map<string, string[]>();
  for (const e of ctx.parentEdges) {
    if (e.isStep) continue; // lewati saudara/parent tiri (bukan darah)
    const arr = parentsOf.get(e.childId) ?? [];
    if (!arr.includes(e.parentId)) arr.push(e.parentId);
    parentsOf.set(e.childId, arr);
  }

  /** Himpunan pasangan (unordered pair). */
  const partnerPairs = new Set<string>();
  for (const e of ctx.partnerEdges) {
    const key = [e.partnerAId, e.partnerBId].sort().join("|");
    partnerPairs.add(key);
  }

  /** True jika dua orang adalah pasangan. */
  const isPartner = (aId: string, bId: string): boolean =>
    partnerPairs.has([aId, bId].sort().join("|"));

  return { personById, parentsOf, isPartner };
}

/** Kumpulkan leluhur (naik) dengan jaraknya dari `startId`. */
function collectAncestors(
  startId: string,
  parentsOf: Map<string, string[]>,
): Map<string, number> {
  const dist = new Map<string, number>([[startId, 0]]);
  const queue: string[] = [startId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const d = dist.get(id)!;
    for (const p of parentsOf.get(id) ?? []) {
      if (!dist.has(p)) {
        dist.set(p, d + 1);
        queue.push(p);
      }
    }
  }
  return dist;
}

/**
 * Temukan lowest common ancestor (LCA) antara dua orang.
 * Mengembalikan { lca, distA, distB } atau null bila tidak ada leluhur
 * bersama (komponen terpisah).
 */
export function findLowestCommonAncestor(
  aId: string,
  bId: string,
  parentsOf: Map<string, string[]>,
): { lca: string; distA: number; distB: number } | null {
  if (aId === bId) {
    return { lca: aId, distA: 0, distB: 0 };
  }

  const ancA = collectAncestors(aId, parentsOf);

  let best: { lca: string; distA: number; distB: number } | null = null;
  const distB = new Map<string, number>([[bId, 0]]);
  const queue: string[] = [bId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const d = distB.get(id)!;
    const da = ancA.get(id);
    if (da !== undefined) {
      const total = da + d;
      if (!best || total < best.distA + best.distB) {
        best = { lca: id, distA: da, distB: d };
      }
    }
    for (const p of parentsOf.get(id) ?? []) {
      if (!distB.has(p)) {
        distB.set(p, d + 1);
        queue.push(p);
      }
    }
  }
  return best;
}

/** Bandingkan dua tanggal lahir; null bila salah satu/begitu tidak ada. */
function compareBirthDates(
  a: KinshipPerson,
  b: KinshipPerson,
): "OLDER" | "YOUNGER" | null {
  if (!a.birthDate || !b.birthDate) return null;
  const ta = new Date(a.birthDate as string).getTime();
  const tb = new Date(b.birthDate as string).getTime();
  if (Number.isNaN(ta) || Number.isNaN(tb)) return null;
  if (ta < tb) return "OLDER";
  if (ta > tb) return "YOUNGER";
  return null;
}

/** Label orang tua/leluhur untuk `level` langkah ke atas. */
function ancestorLabel(level: number, gender: string): string {
  return getAncestorLabel(level, gender);
}

/** Label dugaan langsung (anak/cucu/dst.) untuk `level` langkah ke bawah. */
function descendantLabel(level: number): string {
  // getAncestorLabel(1)= orang tua; untuk turun, cicit/buyut pakai level sama
  // tapi dari sisi keturunan. Untuk kesederhanaan, pakai label generasi.
  if (level === 1) return "Anak";
  if (level === 2) return "Cucu";
  if (level === 3) return "Cicit (Buyut)";
  return `Keturunan generasi ke-${level}`;
}

/** Label saudara (kakak/adik) berdasarkan usia. */
function siblingLabel(a: KinshipPerson, b: KinshipPerson): {
  label: string;
  reverse: string;
} {
  const cmp = compareBirthDates(a, b);
  if (cmp === "OLDER") return { label: "Kakak", reverse: "Adik" };
  if (cmp === "YOUNGER") return { label: "Adik", reverse: "Kakak" };
  return { label: "Saudara kandung", reverse: "Saudara kandung" };
}

/**
 * Tentukan label paman/bibi dengan istilah Jawa.
 * `sibling` = orang yang paman/bibi (lebih tua satu generasi), `nephew`
 * = keponakan. `connectingParent` = orang tua dari `nephew` yang merupakan
 * saudara dari `sibling` (untuk membandingkan umur).
 */
function uncleAuntLabel(
  sibling: KinshipPerson,
  connectingParent: KinshipPerson | undefined,
): string {
  const male = sibling.gender === "MALE";
  const cmp = connectingParent ? compareBirthDates(sibling, connectingParent) : null;
  if (male) {
    if (cmp === "OLDER") return "Pakdhe";
    if (cmp === "YOUNGER") return "Om";
    return "Paman";
  }
  if (cmp === "OLDER") return "Budhe";
  if (cmp === "YOUNGER") return "Tante";
  return "Bibi";
}

/**
 * Peta relasi dua arah. Mengembalikan hasil bagaimana A melihat B.
 * `distA` = jarak A ke LCA, `distB` = jarak B ke LCA.
 */
export function computeKinship(
  a: KinshipPerson,
  b: KinshipPerson,
  ctx: KinshipContext,
): KinshipResult | null {
  if (!a || !b) return null;
  if (a.id === b.id) {
    return {
      kind: "SELF",
      label: "Diri sendiri",
      reverseLabel: "Diri sendiri",
      description: `${a.fullName} adalah orang yang sama.`,
      reverseDescription: `${a.fullName} adalah orang yang sama.`,
    };
  }

  const { parentsOf, isPartner } = buildGraph(ctx);

  // Pasangan langsung.
  if (isPartner(a.id, b.id)) {
    const aMale = a.gender === "MALE";
    const bFemale = b.gender === "FEMALE";
    if (aMale) {
      return {
        kind: "SPOUSE",
        label: "Suami",
        reverseLabel: "Istri",
        description: `${a.fullName} adalah suami dari ${b.fullName}.`,
        reverseDescription: `${b.fullName} adalah istri dari ${a.fullName}.`,
      };
    }
    if (bFemale) {
      return {
        kind: "SPOUSE",
        label: "Istri",
        reverseLabel: "Suami",
        description: `${a.fullName} adalah istri dari ${b.fullName}.`,
        reverseDescription: `${b.fullName} adalah suami dari ${a.fullName}.`,
      };
    }
    return {
      kind: "SPOUSE",
      label: "Pasangan",
      reverseLabel: "Pasangan",
      description: `${a.fullName} dan ${b.fullName} adalah pasangan (suami/istri).`,
      reverseDescription: `${a.fullName} dan ${b.fullName} adalah pasangan (suami/istri).`,
    };
  }

  const lcaRaw = findLowestCommonAncestor(a.id, b.id, parentsOf);
  if (!lcaRaw) {
    return null; // tidak ada hubungan darah yang ditemukan
  }
  const { lca, distA, distB } = lcaRaw;

  // A adalah leluhur B.
  if (distA === 0) {
    const label = ancestorLabel(distB, a.gender);
    return {
      kind: "ANCESTOR",
      label,
      reverseLabel: descendantLabel(distB),
      description: `${a.fullName} adalah ${label.toLowerCase()} dari ${b.fullName}.`,
      reverseDescription: `${b.fullName} adalah ${descendantLabel(distB).toLowerCase()} dari ${a.fullName}.`,
    };
  }

  // B adalah leluhur A.
  if (distB === 0) {
    const label = ancestorLabel(distA, b.gender);
    return {
      kind: "DESCENDANT",
      label: descendantLabel(distA),
      reverseLabel: label,
      description: `${a.fullName} adalah ${descendantLabel(distA).toLowerCase()} dari ${b.fullName}.`,
      reverseDescription: `${b.fullName} adalah ${label.toLowerCase()} dari ${a.fullName}.`,
    };
  }

  // Saudara (satu generasi, berbagi orang tua).
  if (distA === 1 && distB === 1) {
    const { label, reverse } = siblingLabel(a, b);
    return {
      kind: "SIBLING",
      label,
      reverseLabel: reverse,
      description: `${a.fullName} adalah ${label.toLowerCase()} (saudara kandung) dari ${b.fullName}.`,
      reverseDescription: `${b.fullName} adalah ${reverse.toLowerCase()} dari ${a.fullName}.`,
    };
  }

  // Sepupu (generasi sama, berbagi kakek/nenek/dst.).
  if (distA === distB) {
    const cousinNumber = distA - 1; // 1 = sepupu, 2 = sepupu dua kali, dst.
    let label: string;
    if (cousinNumber === 1) label = "Sepupu";
    else if (cousinNumber === 2) label = "Sepupu dua kali";
    else label = `Sepupu ${cousinNumber} kali`;
    return {
      kind: "COUSIN",
      label,
      reverseLabel: label,
      description: `${a.fullName} adalah ${label.toLowerCase()} dari ${b.fullName} (berbagi leluhur, ${distA} generasi di bawah).`,
      reverseDescription: `${b.fullName} adalah ${label.toLowerCase()} dari ${a.fullName}.`,
    };
  }

  // Generasi berbeda — paman/bibi/keponakan atau sepupu "diangkat".
  const removed = Math.abs(distA - distB);
  const minDist = Math.min(distA, distB);
  const cousinNumber = minDist - 1;

  if (removed === 1 && cousinNumber === 0) {
    // Satu generasi berbeda & saudara dari orang tua → paman/bibi / keponakan.
    // Identifikasi siapa senior (lebih tua generasi / lebih dekat leluhur).
    const aIsSenior = distA < distB;
    const senior = aIsSenior ? a : b;
    const junior = aIsSenior ? b : a;
    // connectingParent = orang tua si junior yang merupakan saudara senior
    // (anak dari LCA). Dipakai membedakan Pakdhe/Om/Budhe/Tante.
    const juniorParents = parentsOf.get(junior.id) ?? [];
    const connectingParent = juniorParents
      .map((pid) => ctx.persons.find((p) => p.id === pid))
      .find(
        (p) => p && (parentsOf.get(p.id) ?? []).includes(lca),
      );
    const seniorLabel = uncleAuntLabel(senior, connectingParent);
    if (aIsSenior) {
      return {
        kind: "UNCLE_AUNT",
        label: seniorLabel,
        reverseLabel: "Keponakan",
        description: `${a.fullName} adalah ${seniorLabel} dari ${b.fullName} (saudara dari orang tua ${b.fullName}).`,
        reverseDescription: `${b.fullName} adalah keponakan dari ${a.fullName}.`,
      };
    }
    return {
      kind: "NIECE_NEPHEW",
      label: "Keponakan",
      reverseLabel: seniorLabel,
      description: `${a.fullName} adalah keponakan dari ${b.fullName}.`,
      reverseDescription: `${b.fullName} adalah ${seniorLabel} dari ${a.fullName}.`,
    };
  }

  // Sepupu dengan "removed" (selisih generasi > 0).
  let label: string;
  if (cousinNumber <= 0) label = `Sepupu (${removed} generasi terpisah)`;
  else if (cousinNumber === 1) {
    label = removed === 1 ? "Sepupu sekali" : `Sepupu sekali (${removed} generasi terpisah)`;
  } else {
    label = `Sepupu ${cousinNumber} kali (${removed} generasi terpisah)`;
  }
  return {
    kind: "COUSIN_REMOVED",
    label,
    reverseLabel: label,
    description: `${a.fullName} dan ${b.fullName} adalah ${label.toLowerCase()} (berbagi leluhur ${lca}).`,
    reverseDescription: `${a.fullName} dan ${b.fullName} adalah ${label.toLowerCase()}.`,
  };
}

/**
 * API tingkat tinggi: dari kumpulan orang/edge, hitung relasi antar dua id.
 * Mengembalikan null bila salah satu orang tidak ada atau tidak ada hubungan.
 */
export function computeKinshipByIds(
  aId: string,
  bId: string,
  ctx: KinshipContext,
): { result: KinshipResult; a: KinshipPerson; b: KinshipPerson } | null {
  const a = ctx.persons.find((p) => p.id === aId);
  const b = ctx.persons.find((p) => p.id === bId);
  if (!a || !b) return null;
  const result = computeKinship(a, b, ctx);
  if (!result) return null;
  return { result, a, b };
}

import { prisma } from "@/lib/prisma";

/**
 * Tipe saudara berdasarkan hubungan darah/pernikahan.
 * Sesuai istilah adat Jawa (sumber: detikJogja, Kompas, KBJI Kemendikdasmen).
 */
export type SiblingType =
  | "FULL"             // sedulur (seayah + seibu)
  | "PATERNAL_HALF"    // sedulur kuwalon (seayah, beda ibu)
  | "MATERNAL_HALF"    // sedulur srilak / sedulur asu (seibu, beda ayah)
  | "STEP"             // sedulur tiri / kuwalon (hubungan pernikahan)
  | "ADOPTED";         // anak angkat

export type KinshipRelation =
  | "FATHER"
  | "MOTHER"
  | "SON"
  | "DAUGHTER"
  | "SPOUSE"
  | "EX_SPOUSE"
  | "FULL_SIBLING"
  | "PATERNAL_HALF_SIBLING"
  | "MATERNAL_HALF_SIBLING"
  | "STEP_SIBLING"
  | "ADOPTED_CHILD"
  | "STEP_CHILD"
  | "FATHER_IN_LAW"
  | "MOTHER_IN_LAW";

export function getSiblingLabelJawa(type: SiblingType): string {
  switch (type) {
    case "FULL":
      return "Sedulur";
    case "PATERNAL_HALF":
      return "Sedulur kuwalon";
    case "MATERNAL_HALF":
      return "Sedulur srilak";
    case "STEP":
      return "Sedulur tiri (kuwalon)";
    case "ADOPTED":
      return "Anak angkat";
  }
}

export function getSiblingDescription(type: SiblingType): string {
  switch (type) {
    case "FULL":
      return "Saudara kandung (satu ayah dan satu ibu)";
    case "PATERNAL_HALF":
      return "Saudara sebapak beda ibu. Dalam Jawa disebut sedulur kuwalon.";
    case "MATERNAL_HALF":
      return "Saudara seibu beda bapak. Dalam Jawa disebut sedulur srilak atau sedulur asu.";
    case "STEP":
      return "Saudara tiri / kuwalon (hubungan dari pernikahan, bukan darah).";
    case "ADOPTED":
      return "Anak angkat (resmi secara hukum/adat).";
  }
}

/** Representasi ringkas anggota keluarga */
export type FamilyMember = {
  id: string;
  fullName: string;
  nickname: string | null;
  photoUrl: string | null;
  gender: string;
  generationLevel: number | null;
  isDeceased: boolean;
};

export type SiblingGroup = {
  type: SiblingType;
  label: string;
  description: string;
  members: FamilyMember[];
};

/**
 * Klasifikasi hubungan saudara antara dua orang.
 */
export async function classifySibling(
  personId: string,
  potentialSiblingId: string,
): Promise<SiblingType | null> {
  if (personId === potentialSiblingId) return null;

  const [personParents, siblingParents] = await Promise.all([
    prisma.personChild.findMany({
      where: { childId: personId },
      select: { parentId: true, parentRole: true, isAdopted: true, isStep: true },
    }),
    prisma.personChild.findMany({
      where: { childId: potentialSiblingId },
      select: { parentId: true, parentRole: true, isAdopted: true, isStep: true },
    }),
  ]);

  const personFathers = personParents.filter((p) => p.parentRole === "FATHER" && !p.isStep).map((p) => p.parentId);
  const personMothers = personParents.filter((p) => p.parentRole === "MOTHER" && !p.isStep).map((p) => p.parentId);
  const siblingFathers = siblingParents.filter((p) => p.parentRole === "FATHER" && !p.isStep).map((p) => p.parentId);
  const siblingMothers = siblingParents.filter((p) => p.parentRole === "MOTHER" && !p.isStep).map((p) => p.parentId);

  const sharedFather = personFathers.some((f) => siblingFathers.includes(f));
  const sharedMother = personMothers.some((m) => siblingMothers.includes(m));

  if (sharedFather && sharedMother) return "FULL";
  if (sharedFather && !sharedMother) return "PATERNAL_HALF";
  if (sharedMother && !sharedFather) return "MATERNAL_HALF";

  // Cek step sibling
  const personStepParents = personParents.filter((p) => p.isStep).map((p) => p.parentId);
  const siblingStepParents = siblingParents.filter((p) => p.isStep).map((p) => p.parentId);
  if (personStepParents.some((p) => siblingStepParents.includes(p))) return "STEP";

  // Cek adopted
  if (personParents.some((p) => p.isAdopted) || siblingParents.some((p) => p.isAdopted)) return "ADOPTED";

  return null;
}

/**
 * Ambil semua saudara dari seseorang, terklasifikasi.
 */
export async function getClassifiedSiblings(personId: string): Promise<SiblingGroup[]> {
  const parents = await prisma.personChild.findMany({
    where: { childId: personId },
    select: { parentId: true, parentRole: true, isStep: true },
  });

  const fatherIds = parents.filter((p) => p.parentRole === "FATHER").map((p) => p.parentId);
  const motherIds = parents.filter((p) => p.parentRole === "MOTHER").map((p) => p.parentId);

  // Semua anak dari semua ayah
  const paternal = fatherIds.length > 0
    ? await prisma.personChild.findMany({
        where: { parentId: { in: fatherIds }, childId: { not: personId } },
        select: { childId: true, isStep: true, isAdopted: true, parentRole: true },
      })
    : [];

  // Semua anak dari semua ibu
  const maternal = motherIds.length > 0
    ? await prisma.personChild.findMany({
        where: { parentId: { in: motherIds }, childId: { not: personId } },
        select: { childId: true, isStep: true, isAdopted: true, parentRole: true },
      })
    : [];

  // Klasifikasikan
  const paternalMap = new Map(paternal.map((p) => [p.childId, p]));
  const maternalMap = new Map(maternal.map((m) => [m.childId, m]));

  const seen = new Set<string>();
  const groups: Record<string, { type: SiblingType; ids: string[] }> = {
    FULL: { type: "FULL", ids: [] },
    PATERNAL_HALF: { type: "PATERNAL_HALF", ids: [] },
    MATERNAL_HALF: { type: "MATERNAL_HALF", ids: [] },
    STEP: { type: "STEP", ids: [] },
    ADOPTED: { type: "ADOPTED", ids: [] },
  };

  for (const [childId, p] of paternalMap) {
    if (seen.has(childId)) continue;
    seen.add(childId);
    if (p.isStep) { groups.STEP.ids.push(childId); continue; }
    if (p.isAdopted) { groups.ADOPTED.ids.push(childId); continue; }
    if (maternalMap.has(childId)) {
      const m = maternalMap.get(childId)!;
      if (m.isStep || m.isAdopted) { groups.STEP.ids.push(childId); continue; }
      groups.FULL.ids.push(childId);
    } else {
      groups.PATERNAL_HALF.ids.push(childId);
    }
  }

  for (const [childId, m] of maternalMap) {
    if (seen.has(childId)) continue;
    seen.add(childId);
    if (m.isStep) { groups.STEP.ids.push(childId); continue; }
    if (m.isAdopted) { groups.ADOPTED.ids.push(childId); continue; }
    groups.MATERNAL_HALF.ids.push(childId);
  }

  // Ambil data detail
  const result: SiblingGroup[] = [];
  for (const g of Object.values(groups)) {
    if (g.ids.length === 0) continue;
    const members = await prisma.person.findMany({
      where: { id: { in: g.ids } },
      select: { id: true, fullName: true, nickname: true, photoUrl: true, gender: true, generationLevel: true, isDeceased: true },
    });
    result.push({
      type: g.type,
      label: getSiblingLabelJawa(g.type),
      description: getSiblingDescription(g.type),
      members: members as FamilyMember[],
    });
  }

  return result;
}

/**
 * Ambil orang tua dan pasangan dari seseorang untuk panel keluarga terdekat.
 */
export async function getImmediateFamily(personId: string) {
  const [person, parentEdges, partnerEdges, childEdges] = await Promise.all([
    prisma.person.findUnique({
      where: { id: personId },
      select: { id: true, fullName: true, nickname: true, photoUrl: true, gender: true, generationLevel: true, isDeceased: true },
    }),
    prisma.personChild.findMany({
      where: { childId: personId },
      include: { parent: { select: { id: true, fullName: true, nickname: true, photoUrl: true, gender: true, generationLevel: true, isDeceased: true } } },
    }),
    prisma.personPartner.findMany({
      where: { OR: [{ partnerAId: personId }, { partnerBId: personId }] },
      include: {
        partnerA: { select: { id: true, fullName: true, nickname: true, photoUrl: true, gender: true, generationLevel: true, isDeceased: true } },
        partnerB: { select: { id: true, fullName: true, nickname: true, photoUrl: true, gender: true, generationLevel: true, isDeceased: true } },
      },
      orderBy: { orderIndex: "asc" },
    }),
    prisma.personChild.findMany({
      where: { parentId: personId },
      include: { child: { select: { id: true, fullName: true, nickname: true, photoUrl: true, gender: true, generationLevel: true, isDeceased: true } } },
    }),
  ]);

  if (!person) return null;

  return {
    person: person as FamilyMember,
    parents: parentEdges.map((e) => ({
      member: e.parent as FamilyMember,
      role: e.parentRole,
      isStep: e.isStep,
      isAdopted: e.isAdopted,
    })),
    partners: partnerEdges.map((e) => ({
      member: (e.partnerAId === personId ? e.partnerB : e.partnerA) as FamilyMember,
      status: e.status,
      orderIndex: e.orderIndex,
      marriageDate: e.marriageDate,
      divorceDate: e.divorceDate,
    })),
    children: childEdges.map((e) => ({
      member: e.child as FamilyMember,
      isStep: e.isStep,
      isAdopted: e.isAdopted,
    })),
  };
}

/**
 * Hitung generationLevel dari akar keluarga (orang tanpa orang tua dengan level terkecil).
 * Dilakukan saat persetujuan pengajuan atau perubahan relasi.
 */
export async function recalculateGenerationLevel(personId: string): Promise<number> {
  const queue: { id: string; level: number }[] = [{ id: personId, level: 0 }];
  const visited = new Set<string>();
  let maxLevel = 0;

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.id)) continue;
    visited.add(current.id);
    maxLevel = Math.max(maxLevel, current.level);

    // Cari anak untuk propagate
    const childEdges = await prisma.personChild.findMany({
      where: { parentId: current.id },
      select: { childId: true },
    });

    for (const edge of childEdges) {
      if (!visited.has(edge.childId)) {
        queue.push({ id: edge.childId, level: current.level + 1 });
      }
    }
  }

  await prisma.person.update({
    where: { id: personId },
    data: { generationLevel: maxLevel },
  });

  return maxLevel;
}

/**
 * Rekalkulasi level untuk banyak orang (mis. setelah approval batch).
 */
export async function recalculateAllGenerationLevels() {
  const roots = await prisma.person.findMany({
    where: { generationLevel: 0 },
    select: { id: true },
  });

  for (const root of roots) {
    await recalculateGenerationLevel(root.id);
  }
}
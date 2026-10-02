// Server-only. Modul ini memakai `@/lib/prisma` sehingga TIDAK BOLEH di-import
// oleh komponen client. Label adat Jawa dikirim dari server agar client tidak
// perlu memuat logika pohon keluarga.

import { prisma } from "@/lib/prisma";
import { assertBranchAccess, AuthorizationError, type AdminScope } from "@/lib/rbac";
import {
  getClassifiedSiblings,
  getSiblingLabelJawa,
  type SiblingGroup,
  type SiblingType,
} from "@/lib/genealogy";
import { getAncestorLabel, getDescendantLabel } from "@/lib/generations";

// Re-export agar import lama (test dan modul lain) tetap berjalan.
export { getAncestorLabel };

export type TreeMember = {
  id: string;
  fullName: string;
  nickname: string | null;
  namaPanggilan: string | null;
  photoUrl: string | null;
  gender: string;
  generationLevel: number | null;
  isDeceased: boolean;
};

export type AncestorEntry = TreeMember & { label: string };
export type AncestorLevel = { level: number; label: string; members: AncestorEntry[] };
export type DescendantLevel = { level: number; label: string; members: TreeMember[] };
export type SiblingSection = {
  type: SiblingType;
  label: string;
  description: string;
  members: TreeMember[];
};
export type ParentEntry = TreeMember & {
  edgeId: string;
  role: string;
  isStep: boolean;
  isAdopted: boolean;
};
export type ChildEntry = TreeMember & {
  edgeId: string;
  isStep: boolean;
  isAdopted: boolean;
  parentRole: string;
  birthDate: string | null;
  birthPlace: string | null;
};
export type PartnerEntry = {
  edgeId: string;
  status: string;
  marriageDate: string | null;
  divorceDate: string | null;
  notes: string | null;
  member: TreeMember;
};

export type PrivateContact = {
  visibleToMembers: boolean;
  city: string | null;
  province: string | null;
  addressLine: string | null;
  postalCode: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  maritalStatus: string | null;
};

export type EducationRow = {
  id: string;
  institution: string;
  degree: string | null;
  fieldOfStudy: string | null;
  startYear: number | null;
  endYear: number | null;
};

export type SocialLinkRow = {
  id: string;
  url: string;
  username: string | null;
  platform: { name: string } | null;
};

export type PersonProfile = TreeMember & {
  birthDate: string | null;
  birthPlace: string | null;
  deathDate: string | null;
  deathPlace: string | null;
  occupation: string | null;
  status: string | null;
  bio: string | null;
  isMarriedInto: boolean;
  education: EducationRow[];
  socialLinks: SocialLinkRow[];
  private: PrivateContact | null;
};

export type FamilyTreeData = {
  person: PersonProfile;
  branch: { id: string; name: string; branchNumber: number } | null;
  ancestors: AncestorLevel[];
  siblings: SiblingSection[];
  descendants: DescendantLevel[];
  parents: ParentEntry[];
  children: ChildEntry[];
  partners: PartnerEntry[];
};

type PersonRow = {
  id: string;
  fullName: string;
  nickname: string | null;
  namaPanggilan?: string | null;
  photoUrl: string | null;
  gender: unknown;
  generationLevel: number | null;
  isDeceased: boolean;
  birthDate?: Date | string | null;
  birthPlace?: string | null;
};

type PersonDetailRow = PersonRow & {
  branchId: string | null;
  branch: { id: string; name: string; branchNumber: number } | null;
  birthDate: Date | string | null;
  birthPlace: string | null;
  deathDate: Date | string | null;
  deathPlace?: Date | string | null;
  occupation: string | null;
  status: string | null;
  bio: string | null;
  isMarriedInto: boolean;
  private: Record<string, unknown> | null;
  education?: EducationRow[];
  socialLinks?: SocialLinkRow[];
  parents?: Array<{
    id: string;
    parentRole: string;
    isStep: boolean;
    isAdopted: boolean;
    parent: PersonRow;
  }>;
  children?: Array<{
    id: string;
    parentRole?: string;
    isStep: boolean;
    isAdopted: boolean;
    child: PersonRow;
  }>;
  partnershipsA?: Array<{
    id: string;
    status: string;
    marriageDate?: Date | string | null;
    divorceDate?: Date | string | null;
    notes?: string | null;
    partnerB: PersonRow;
  }>;
  partnershipsB?: Array<{
    id: string;
    status: string;
    marriageDate?: Date | string | null;
    divorceDate?: Date | string | null;
    notes?: string | null;
    partnerA: PersonRow;
  }>;
};

type Edge = {
  childId: string;
  parentId: string;
  parentRole?: string;
  isStep?: boolean;
  isAdopted?: boolean;
  orderIndex?: number;
};

export type TreeDb = {
  person: {
    findUnique(args: unknown): Promise<PersonDetailRow | null>;
    findMany(args: unknown): Promise<PersonRow[]>;
  };
  personChild: {
    findMany(args: unknown): Promise<Edge[]>;
  };
};

const TREE_SELECT = {
  id: true,
  fullName: true,
  nickname: true,
  namaPanggilan: true,
  photoUrl: true,
  gender: true,
  generationLevel: true,
  isDeceased: true,
} as const;

const MAX_ANCESTOR_LEVEL = 12;
const MAX_DESCENDANT_LEVEL = 8;

function toMember(row: PersonRow): TreeMember {
  return {
    id: row.id,
    fullName: row.fullName,
    nickname: row.nickname,
    namaPanggilan: row.namaPanggilan ?? null,
    photoUrl: row.photoUrl,
    gender: typeof row.gender === "string" ? row.gender : String(row.gender),
    generationLevel: row.generationLevel,
    isDeceased: row.isDeceased,
  };
}

/**
 * Susun daftar generasi ke atas dari rantai parent.
 * Level berisi `(Kosong)` bila tidak ada leluhur di tingkat itu.
 */
export function buildAncestorLevels(
  startId: string,
  parentsOf: Map<string, string[]>,
  members: Map<string, TreeMember>,
): AncestorLevel[] {
  const levels: string[][] = [];
  const seen = new Set<string>([startId]);
  let frontier = [...(parentsOf.get(startId) ?? [])].filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  // Level 1 selalu ada agar UI dapat menampilkan "(Kosong)".
  for (let level = 1; level <= MAX_ANCESTOR_LEVEL && (level === 1 || frontier.length > 0); level++) {
    levels.push(frontier);
    const next: string[] = [];
    for (const id of frontier) {
      for (const parent of parentsOf.get(id) ?? []) {
        if (seen.has(parent)) continue;
        seen.add(parent);
        next.push(parent);
      }
    }
    frontier = next;
  }

  return levels.map((ids, index) => {
    const level = index + 1;
    const label = getAncestorLabel(level);
    return {
      level,
      label,
      members: ids.map((id) => {
        const member = members.get(id);
        if (!member) return null;
        return { ...member, label: getAncestorLabel(level, member.gender) };
      }).filter((m): m is AncestorEntry => m !== null),
    };
  });
}

/**
 * Susun daftar generasi di bawah (anak, cucu, dst).
 * Label memakai adat Jawa dari `getDescendantLabel`.
 */
export function buildDescendantLevels(
  startId: string,
  childrenOf: Map<string, string[]>,
  members: Map<string, TreeMember>,
): DescendantLevel[] {
  const levels: string[][] = [];
  const seen = new Set<string>([startId]);
  let frontier = [...(childrenOf.get(startId) ?? [])].filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  for (let level = 1; level <= MAX_DESCENDANT_LEVEL && (level === 1 || frontier.length > 0); level++) {
    levels.push(frontier);
    const next: string[] = [];
    for (const id of frontier) {
      for (const child of childrenOf.get(id) ?? []) {
        if (seen.has(child)) continue;
        seen.add(child);
        next.push(child);
      }
    }
    frontier = next;
  }

  return levels.map((ids, index) => {
    const level = index + 1;
    return {
      level,
      label: getDescendantLabel(level),
      members: ids.map((id) => members.get(id)).filter((m): m is TreeMember => m !== null),
    };
  });
}

/** Bentuk hasil `getClassifiedSiblings` menjadi bagian siap tampil. */
export function toSiblingSections(groups: SiblingGroup[]): SiblingSection[] {
  return groups
    .filter((group) => group.members.length > 0)
    .map((group) => ({
      type: group.type,
      label: getSiblingLabelJawa(group.type),
      description: group.description,
      members: group.members.map(toMember),
    }));
}

function serializeDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function buildProfile(row: PersonDetailRow): PersonProfile {
  const privateRow = row.private ?? null;
  const pick = (key: string): string | null => {
    const raw = privateRow ? privateRow[key] : null;
    return typeof raw === "string" && raw.length > 0 ? raw : null;
  };

  const contact: PrivateContact | null = privateRow
    ? {
        visibleToMembers: privateRow.visibleToMembers === true,
        city: pick("city"),
        province: pick("province"),
        addressLine: pick("addressLine"),
        postalCode: pick("postalCode"),
        phone: pick("phone"),
        whatsapp: pick("whatsapp"),
        email: pick("email"),
        maritalStatus: pick("maritalStatus"),
      }
    : null;

  return {
    ...toMember(row),
    birthDate: serializeDate(row.birthDate),
    birthPlace: row.birthPlace ?? null,
    deathDate: serializeDate(row.deathDate),
    // `deathPlace` ditambahkan berjalan oleh task lain; akses defensif agar build tidak patah.
    deathPlace: typeof (row as Record<string, unknown>).deathPlace === "string" ? (row as Record<string, unknown>).deathPlace as string : null,
    occupation: row.occupation ?? null,
    status: row.status ?? null,
    bio: row.bio ?? null,
    isMarriedInto: row.isMarriedInto === true,
    education: row.education ?? [],
    socialLinks: (row.socialLinks ?? []).map((link) => ({
      id: link.id,
      url: link.url,
      username: link.username,
      platform: link.platform ?? null,
    })),
    private: contact,
  };
}

async function collectEdges(
  db: TreeDb,
  startId: string,
  direction: "up" | "down",
  maxLevel: number,
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  const seen = new Set<string>([startId]);
  let frontier = [startId];

  for (let depth = 0; depth < maxLevel && frontier.length > 0; depth++) {
    const where = direction === "up" ? { childId: { in: frontier } } : { parentId: { in: frontier } };
    const edges = await db.personChild.findMany({
      where,
      select: { childId: true, parentId: true, orderIndex: true },
      orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
    });
    const next: string[] = [];

    for (const edge of edges) {
      const key = direction === "up" ? edge.childId : edge.parentId;
      const target = direction === "up" ? edge.parentId : edge.childId;
      const list = map.get(key) ?? [];
      if (!list.includes(target)) list.push(target);
      map.set(key, list);

      if (!seen.has(target)) {
        seen.add(target);
        next.push(target);
      }
    }

    frontier = next;
  }

  return map;
}

function flattenTargets(map: Map<string, string[]>): string[] {
  const ids = new Set<string>();
  for (const values of map.values()) {
    for (const value of values) ids.add(value);
  }
  return [...ids];
}

export type FamilyTreeOptions = {
  db?: TreeDb;
  siblingProvider?: (personId: string) => Promise<SiblingGroup[]>;
};

function toIsoOrNull(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function buildPartners(person: PersonDetailRow): PartnerEntry[] {
  const fromA = (person.partnershipsA ?? []).map((row) => ({
    edgeId: row.id,
    status: row.status,
    marriageDate: toIsoOrNull(row.marriageDate),
    divorceDate: toIsoOrNull(row.divorceDate),
    notes: row.notes ?? null,
    member: toMember(row.partnerB),
  }));
  const fromB = (person.partnershipsB ?? []).map((row) => ({
    edgeId: row.id,
    status: row.status,
    marriageDate: toIsoOrNull(row.marriageDate),
    divorceDate: toIsoOrNull(row.divorceDate),
    notes: row.notes ?? null,
    member: toMember(row.partnerA),
  }));
  return [...fromA, ...fromB];
}

/**
 * Susun seluruh konteks pohon keluarga satu anggota.
 * RBAC gagal tertutup: cabang di luar cakupan admin ditolak 403.
 */
export async function getFamilyTreeData(
  personId: string,
  scope: AdminScope,
  options: FamilyTreeOptions = {},
): Promise<FamilyTreeData> {
  const db = (options.db ?? (prisma as unknown as TreeDb)) as TreeDb;
  const siblingProvider =
    options.siblingProvider ?? ((id: string) => getClassifiedSiblings(id));

  // Tanpa `include` Prisma hanya mengembalikan kolom scalarnya, sehingga
  // `branch`, `parents`, `children`, dan `partnerships*` selalu `undefined`
  // dan payload diam-diam menjadi kosong.
  const person = await db.person.findUnique({
    where: { id: personId },
    include: {
      branch: true,
      private: true,
      education: true,
      socialLinks: { include: { platform: true } },
      parents: { include: { parent: true } },
      children: {
        include: { child: true },
        orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
      },
      partnershipsA: {
        select: {
          id: true,
          status: true,
          marriageDate: true,
          divorceDate: true,
          notes: true,
          partnerB: true,
        },
      },
      partnershipsB: {
        select: {
          id: true,
          status: true,
          marriageDate: true,
          divorceDate: true,
          notes: true,
          partnerA: true,
        },
      },
    },
  });
  if (!person) {
    throw new AuthorizationError("Anggota tidak ditemukan", 404);
  }

  // Fail-closed: tanpa cabang aktif, BRANCH_ADMIN tidak boleh membaca apa pun.
  assertBranchAccess(scope, person.branchId ?? "");

  const [parentsOf, childrenOf] = await Promise.all([
    collectEdges(db, personId, "up", MAX_ANCESTOR_LEVEL),
    collectEdges(db, personId, "down", MAX_DESCENDANT_LEVEL),
  ]);

  const idsToLoad = new Set<string>([...flattenTargets(parentsOf), ...flattenTargets(childrenOf)]);
  const rows = idsToLoad.size
    ? await db.person.findMany({ where: { id: { in: [...idsToLoad] } }, select: TREE_SELECT })
    : [];
  const members = new Map<string, TreeMember>(rows.map((row) => [row.id, toMember(row)]));

  const [siblings] = await Promise.all([siblingProvider(personId)]);

  return {
    person: buildProfile(person),
    branch: person.branch ?? null,
    ancestors: buildAncestorLevels(personId, parentsOf, members),
    siblings: toSiblingSections(siblings),
    descendants: buildDescendantLevels(personId, childrenOf, members),
    parents: (person.parents ?? []).map((edge) => ({
      ...toMember(edge.parent),
      edgeId: edge.id,
      role: edge.parentRole,
      isStep: edge.isStep === true,
      isAdopted: edge.isAdopted === true,
    })),
    children: (person.children ?? []).map((edge) => ({
      ...toMember(edge.child),
      edgeId: edge.id,
      isStep: edge.isStep === true,
      isAdopted: edge.isAdopted === true,
      parentRole: edge.parentRole ?? "",
      birthDate: edge.child.birthDate ? toIsoOrNull(edge.child.birthDate) : null,
      birthPlace: edge.child.birthPlace ?? null,
    })),
    partners: buildPartners(person),
  };
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAncestorLabel, getDescendantLabel } from "@/lib/generations";
import { orderIndexForChild, setChildOrderIndex, type ChildOrderDb } from "@/lib/child-order";
import { z } from "zod";

type PartnerStatus = "MARRIED" | "DIVORCED" | "WIDOWED" | "UNKNOWN";

const memberSelect = {
  id: true,
  fullName: true,
  nickname: true,
  gender: true,
  photoUrl: true,
  generationLevel: true,
  isDeceased: true,
  branchId: true,
  birthDate: true,
} as const;

function siblingRelation(roles: Set<string>): string {
  if (roles.has("FATHER") && roles.has("MOTHER")) return "Saudara kandung";
  if (roles.has("FATHER")) return "Saudara seayah";
  if (roles.has("MOTHER")) return "Saudara seibu";
  return "Saudara";
}

function mapPartnerStatus(value?: string): PartnerStatus {
  switch (value) {
    case "MENIKAH":
      return "MARRIED";
    case "CERAI":
      return "DIVORCED";
    case "JANDA":
    case "DUDA":
      return "WIDOWED";
    default:
      return "UNKNOWN";
  }
}

function parseDate(value?: string): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === "" || value === null) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function ownPersonId() {
  const session = await auth();
  if (!session?.user) return { status: 401 as const, error: "Tidak terautentikasi" };
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { personId: true },
  });
  if (!user) return { status: 404 as const, error: "Akun tidak ditemukan" };
  return { personId: user.personId, userId: session.user.id };
}

export async function GET(request: Request) {
  const authz = await ownPersonId();
  if ("error" in authz) {
    return NextResponse.json({ error: authz.error }, { status: authz.status });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q");
  const scope = url.searchParams.get("scope");

  const person = await prisma.person.findUnique({
    where: { id: authz.personId },
    select: memberSelect,
  });
  if (!person) {
    return NextResponse.json({ error: "Profil tidak ditemukan" }, { status: 404 });
  }

  // Pencarian kandidat (untuk memilih orang tua / pasangan).
  if (query !== null) {
    const keyword = query.trim();
    const candidates = await prisma.person.findMany({
      where: {
        id: { not: person.id },
        ...(scope === "all" ? {} : { branchId: person.branchId }),
        ...(keyword
          ? {
              OR: [
                { fullName: { contains: keyword, mode: "insensitive" } },
                { nickname: { contains: keyword, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        fullName: true,
        nickname: true,
        gender: true,
        photoUrl: true,
        generationLevel: true,
        isDeceased: true,
        birthDate: true,
      },
      take: 20,
      orderBy: { fullName: "asc" },
    });
    return NextResponse.json({ candidates });
  }

  // Relasi nyata dari graf PersonChild / PersonPartner. Tanpa data berarti kosong.
  const parentEdges = await prisma.personChild.findMany({
    where: { childId: person.id },
    include: { parent: { select: memberSelect } },
    orderBy: { createdAt: "asc" },
  });

  const parents = parentEdges.map((edge) => ({
    id: edge.parent.id,
    fullName: edge.parent.fullName,
    nickname: edge.parent.nickname,
    gender: edge.parent.gender,
    photoUrl: edge.parent.photoUrl,
    isDeceased: edge.parent.isDeceased,
    role: edge.parentRole,
    isStep: edge.isStep,
    isAdopted: edge.isAdopted,
  }));

  // Rantai ke atas (kakek/nenek, buyut, ...).
  const ancestors: Array<Record<string, unknown>> = [];
  const seenAbove = new Set<string>([person.id, ...parentEdges.map((e) => e.parentId)]);
  let above = parentEdges.map((e) => ({ id: e.parentId, depth: 1 }));
  let aboveDepth = 1;
  while (above.length > 0 && aboveDepth < 8) {
    const edges = await prisma.personChild.findMany({
      where: { childId: { in: above.map((a) => a.id) } },
      include: { parent: { select: memberSelect } },
    });
    const next: Array<{ id: string; depth: number }> = [];
    for (const edge of edges) {
      if (seenAbove.has(edge.parentId)) continue;
      seenAbove.add(edge.parentId);
      const parentDepth = above.find((a) => a.id === edge.childId)?.depth ?? aboveDepth;
      const depth = parentDepth + 1;
      ancestors.push({
        id: edge.parent.id,
        fullName: edge.parent.fullName,
        nickname: edge.parent.nickname,
        gender: edge.parent.gender,
        photoUrl: edge.parent.photoUrl,
        isDeceased: edge.parent.isDeceased,
        depth,
        label: getAncestorLabel(depth, edge.parent.gender),
        via: edge.childId,
      });
      next.push({ id: edge.parentId, depth });
    }
    above = next;
    aboveDepth += 1;
  }

  // Saudara: anak lain dari orang tua kita.
  const parentIds = parentEdges.map((e) => e.parentId);
  const siblingEdges =
    parentIds.length > 0
      ? await prisma.personChild.findMany({
          where: { parentId: { in: parentIds }, childId: { not: person.id } },
          include: { child: { select: memberSelect } },
        })
      : [];
  const byChild = new Map<string, { member: Record<string, unknown>; roles: Set<string> }>();
  for (const edge of siblingEdges) {
    const entry = byChild.get(edge.childId) ?? {
      member: edge.child as unknown as Record<string, unknown>,
      roles: new Set<string>(),
    };
    entry.roles.add(edge.parentRole);
    byChild.set(edge.childId, entry);
  }
  const siblings = Array.from(byChild.values()).map(({ member, roles }) => ({
    id: member.id,
    fullName: member.fullName,
    nickname: member.nickname,
    gender: member.gender,
    photoUrl: member.photoUrl,
    isDeceased: member.isDeceased,
    relation: siblingRelation(roles),
  }));

  // Anak, diurutkan: orderIndex naik, lalu tanggal lahir paling tua, lalu id.
  // Tanpa tanggal lahir diletakkan di akhir.
  const childEdges = await prisma.personChild.findMany({
    where: { parentId: person.id },
    include: { child: { select: memberSelect } },
  });
  const children = childEdges
    .map((edge) => ({
      id: edge.child.id,
      fullName: edge.child.fullName,
      nickname: edge.child.nickname,
      gender: edge.child.gender,
      photoUrl: edge.child.photoUrl,
      isDeceased: edge.child.isDeceased,
      birthDate: edge.child.birthDate,
      orderIndex: edge.orderIndex,
      isStep: edge.isStep,
      isAdopted: edge.isAdopted,
    }))
    .sort((a, b) => {
      if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
      const left = a.birthDate ? new Date(a.birthDate).getTime() : Number.POSITIVE_INFINITY;
      const right = b.birthDate ? new Date(b.birthDate).getTime() : Number.POSITIVE_INFINITY;
      if (left !== right) return left - right;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

  // Keturunan selain anak langsung (cucu ke bawah).
  const descendants: Array<Record<string, unknown>> = [];
  const seenBelow = new Set<string>([person.id, ...childEdges.map((e) => e.childId)]);
  let below = childEdges.map((e) => ({ id: e.childId, depth: 1 }));
  let belowDepth = 1;
  while (below.length > 0 && belowDepth < 8) {
    const edges = await prisma.personChild.findMany({
      where: { parentId: { in: below.map((b) => b.id) } },
      include: { child: { select: memberSelect } },
    });
    const next: Array<{ id: string; depth: number }> = [];
    for (const edge of edges) {
      if (seenBelow.has(edge.childId)) continue;
      seenBelow.add(edge.childId);
      const parentDepth = below.find((b) => b.id === edge.parentId)?.depth ?? belowDepth;
      const depth = parentDepth + 1;
      if (depth >= 2) {
        descendants.push({
          id: edge.child.id,
          fullName: edge.child.fullName,
          nickname: edge.child.nickname,
          gender: edge.child.gender,
          photoUrl: edge.child.photoUrl,
          isDeceased: edge.child.isDeceased,
          depth,
          label: getDescendantLabel(depth),
        });
      }
      next.push({ id: edge.childId, depth });
    }
    below = next;
    belowDepth += 1;
  }

  const partnerEdges = await prisma.personPartner.findMany({
    where: { OR: [{ partnerAId: person.id }, { partnerBId: person.id }] },
    include: {
      partnerA: { select: memberSelect },
      partnerB: { select: memberSelect },
    },
    orderBy: { orderIndex: "asc" },
  });
  const partnersByMember = new Map<string, Record<string, unknown>>();
  for (const edge of partnerEdges) {
    const memberId = edge.partnerAId === person.id ? edge.partnerBId : edge.partnerAId;
    if (partnersByMember.has(memberId)) continue;
    const member = edge.partnerAId === person.id ? edge.partnerB : edge.partnerA;
    partnersByMember.set(memberId, {
      id: member.id,
      fullName: member.fullName,
      nickname: member.nickname,
      gender: member.gender,
      photoUrl: member.photoUrl,
      isDeceased: member.isDeceased,
      status: edge.status,
      orderIndex: edge.orderIndex,
      marriageDate: edge.marriageDate,
      marriagePlace: edge.notes,
    });
  }
  const partners = [...partnersByMember.values()];

  return NextResponse.json({
    relations: { parents, ancestors, siblings, children, descendants, partners },
  });
}

const postSchema = z.object({
  action: z.enum(["setParent", "setPartner"]),
  profileId: z.string().max(100).optional(),
  personId: z.string().min(1).max(100).optional(),
  role: z.enum(["FATHER", "MOTHER"]).optional(),
  maritalStatus: z.enum(["MENIKAH", "CERAI", "JANDA", "DUDA", "BELUM MENIKAH", "LAINNYA"]).optional(),
  marriageDate: z.string().max(40).optional(),
  marriagePlace: z.string().max(300).optional(),
});

export async function POST(request: Request) {
  const authz = await ownPersonId();
  if ("error" in authz) {
    return NextResponse.json({ error: authz.error }, { status: authz.status });
  }
  const personId = authz.personId;

  const body = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }
  const data = parsed.data;

  // Hanya boleh menyentuh profil sendiri.
  if (data.profileId && data.profileId !== personId) {
    return NextResponse.json(
      { error: "Anda hanya dapat mengubah profil sendiri" },
      { status: 403 },
    );
  }

  if (data.action === "setParent") {
    if (!data.role) {
      return NextResponse.json({ error: "Peran orang tua wajib diisi" }, { status: 400 });
    }
    if (!data.personId) {
      return NextResponse.json({ error: "Anggota orang tua wajib dipilih" }, { status: 400 });
    }
    if (data.personId === personId) {
      return NextResponse.json(
        { error: "Diri sendiri tidak dapat menjadi orang tua" },
        { status: 400 },
      );
    }
    const [self, candidate] = await Promise.all([
      prisma.person.findUnique({ where: { id: personId }, select: { id: true, branchId: true } }),
      prisma.person.findUnique({
        where: { id: data.personId },
        select: { id: true, branchId: true, fullName: true },
      }),
    ]);
    if (!candidate) {
      return NextResponse.json({ error: "Anggota tidak ditemukan" }, { status: 400 });
    }
    if (!self?.branchId || candidate.branchId !== self.branchId) {
      return NextResponse.json(
        { error: "Orang tua harus dari cabang keluarga yang sama" },
        { status: 400 },
      );
    }

    // Satu peran hanya satu orang tua: hapus penunjuk lama yang berbeda.
    await prisma.personChild.deleteMany({
      where: {
        childId: personId,
        parentRole: data.role,
        parentId: { not: data.personId },
      },
    });

    // Himpunan orang tua LENGKAP anak setelah penyetelan ini, supaya nomor
    // urut dihitung dari grup saudara sebenarnya.
    const existingParents = await prisma.personChild.findMany({
      where: { childId: personId },
      select: { parentId: true },
    });
    const parentIds = [
      ...new Set([...existingParents.map((row) => row.parentId), data.personId]),
    ];

    // Nomor dihitung sekali dari himpunan orang tua lengkap, lalu baris baru
    // dibuat dan baris LAMA anak disamakan.
    const nomor = await orderIndexForChild(
      personId,
      parentIds,
      prisma as unknown as ChildOrderDb,
    );
    const edge = await prisma.personChild.upsert({
      where: { parentId_childId: { parentId: data.personId, childId: personId } },
      update: { parentRole: data.role },
      create: {
        parentId: data.personId,
        childId: personId,
        parentRole: data.role,
        orderIndex: nomor,
      },
    });
    await setChildOrderIndex(personId, nomor, prisma as unknown as ChildOrderDb);

    await prisma.auditLog.create({
      data: {
        action: "LINK_PARENT",
        entityType: "Person",
        entityId: personId,
        actorUserId: authz.userId,
      },
    });

    return NextResponse.json({ ok: true, edgeId: edge.id });
  }

  // setPartner
  if (data.marriageDate && Number.isNaN(new Date(data.marriageDate).getTime())) {
    return NextResponse.json({ error: "Tanggal pernikahan tidak valid" }, { status: 400 });
  }

  const marriageDate = parseDate(data.marriageDate) ?? null;
  const status = mapPartnerStatus(data.maritalStatus);

  // Pasangan boleh belum dipilih: status pernikahan tetap bisa disimpan.
  let edgeId: string | null = null;
  if (data.personId) {
    if (data.personId === personId) {
      return NextResponse.json(
        { error: "Diri sendiri tidak dapat menjadi pasangan" },
        { status: 400 },
      );
    }
    const candidate = await prisma.person.findUnique({
      where: { id: data.personId },
      select: { id: true, fullName: true },
    });
    if (!candidate) {
      return NextResponse.json({ error: "Anggota tidak ditemukan" }, { status: 400 });
    }

    // Satu pasangan hanya satu baris: cari dulu tanpa peduli urutan A/B,
    // supaya pemanggilan dengan urutan terbalik tidak membuat baris kedua.
    const existing = await prisma.personPartner.findFirst({
      where: {
        OR: [
          { partnerAId: personId, partnerBId: data.personId },
          { partnerAId: data.personId, partnerBId: personId },
        ],
      },
    });

    if (existing) {
      const updated = await prisma.personPartner.update({
        where: { id: existing.id },
        data: { status, marriageDate, notes: data.marriagePlace ?? null },
      });
      edgeId = updated.id;
    } else {
      const created = await prisma.personPartner.create({
        data: {
          partnerAId: personId,
          partnerBId: data.personId,
          status,
          marriageDate,
          notes: data.marriagePlace ?? null,
          orderIndex: await prisma.personPartner.count({
            where: { OR: [{ partnerAId: personId }, { partnerBId: personId }] },
          }),
        },
      });
      edgeId = created.id;
    }
  }

  await prisma.personPrivate.upsert({
    where: { personId },
    update: { maritalStatus: data.maritalStatus ?? null },
    create: { personId, maritalStatus: data.maritalStatus ?? null },
  });

  await prisma.auditLog.create({
    data: {
      action: "LINK_PARTNER",
      entityType: "Person",
      entityId: personId,
      actorUserId: authz.userId,
    },
  });

  return NextResponse.json({ ok: true, edgeId });
}

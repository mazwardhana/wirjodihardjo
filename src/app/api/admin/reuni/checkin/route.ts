import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { approveWalkInAccount, cancelCheckIn } from "@/lib/buku-tamu";

type AdminUser = { id: string; role: string; isActive: boolean };

async function requireAdmin(): Promise<
  { status: 401 | 403 } | { user: AdminUser }
> {
  const session = await auth();
  if (!session?.user) return { status: 401 };
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, isActive: true },
  });
  if (
    !user ||
    !user.isActive ||
    (user.role !== "SUPER_ADMIN" && user.role !== "BRANCH_ADMIN")
  ) {
    return { status: 403 };
  }
  return { user };
}

// GET: rombongan yang sudah absen untuk satu reuni, plus daftar tamu baru
// (buku tamu QR_SELF) yang belum punya akun dan menunggu persetujuan.
export async function GET(request: Request) {
  const guard = await requireAdmin();
  if ("status" in guard) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: guard.status });
  }

  const url = new URL(request.url);
  const reunionId = url.searchParams.get("reunionId");
  if (!reunionId) {
    return NextResponse.json({ error: "ID reuni diperlukan" }, { status: 400 });
  }

  const rows = await prisma.reunionRegistration.findMany({
    where: { reunionId, checkedInAt: { not: null } },
    orderBy: { checkedInAt: "asc" },
    include: {
      person: {
        select: {
          fullName: true,
          namaPanggilan: true,
          branch: { select: { name: true, branchNumber: true } },
          user: { select: { id: true } },
        },
      },
    },
  });

  // Pengelompokan di memori: baris tanpa checkInGroupId (misal dibuat manual
  // sebelum fitur grup) tetap tampil sebagai kartunya sendiri.
  const groups = new Map<
    string,
    {
      groupId: string;
      checkedInAt: Date | null;
      source: string | null;
      members: Array<{
        registrationId: string;
        fullName: string;
        namaPanggilan: string | null;
        branchName: string | null;
        hasAccount: boolean;
      }>;
    }
  >();
  const pendingAccounts: Array<{
    personId: string;
    fullName: string;
    namaPanggilan: string | null;
    checkedInAt: string;
  }> = [];

  for (const row of rows) {
    const groupId = row.checkInGroupId ?? row.id;
    let group = groups.get(groupId);
    if (!group) {
      group = {
        groupId,
        checkedInAt: row.checkedInAt as Date,
        source: row.checkInSource,
        members: [],
      };
      groups.set(groupId, group);
    }
    const person = row.person;
    const hasAccount = !!person?.user;
    group.members.push({
      registrationId: row.id,
      fullName: person?.fullName ?? "(tanpa profil)",
      namaPanggilan: person?.namaPanggilan ?? null,
      branchName: person?.branch?.name ?? null,
      hasAccount,
    });
    // Tamu baru: absen lewat QR sendiri tapi belum punya akun.
    if (row.checkInSource === "QR_SELF" && !hasAccount && row.personId) {
      pendingAccounts.push({
        personId: row.personId,
        fullName: person?.fullName ?? "(tanpa profil)",
        namaPanggilan: person?.namaPanggilan ?? null,
        checkedInAt: (row.checkedInAt as Date).toISOString(),
      });
    }
  }

  return NextResponse.json({
    groups: Array.from(groups.values()).map((g) => ({
      groupId: g.groupId,
      checkedInAt: g.checkedInAt?.toISOString() ?? null,
      source: g.source,
      members: g.members,
    })),
    pendingAccounts,
  });
}

// POST: persetujuan akun tamu baru atau pembatalan absen.
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if ("status" in guard) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: guard.status });
  }
  const user = guard.user;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  if (body.action === "approve-account") {
    const personId = body.personId;
    if (!personId || typeof personId !== "string") {
      return NextResponse.json({ error: "ID anggota diperlukan" }, { status: 400 });
    }
    const result = await approveWalkInAccount(prisma, {
      personId,
      actorUserId: user.id,
    });
    if (result === "ALREADY_HAS_ACCOUNT") {
      return NextResponse.json({ error: "Anggota ini sudah punya akun" }, { status: 409 });
    }
    await logAudit({
      action: "buku-tamu.approve-account",
      entityType: "ReunionRegistration",
      entityId: personId,
      afterData: { username: result.username },
      actorUserId: user.id,
    });
    return NextResponse.json({ ok: true, username: result.username });
  }

  if (body.action === "cancel-checkin") {
    const registrationId = body.registrationId;
    if (!registrationId || typeof registrationId !== "string") {
      return NextResponse.json({ error: "ID pendaftaran diperlukan" }, { status: 400 });
    }
    // Pembatalan hanya mengosongkan jejak absen, baris pendaftaran tetap ada.
    const ok = await cancelCheckIn(prisma, { registrationId, actorUserId: user.id });
    if (!ok) {
      return NextResponse.json({ error: "Pendaftaran tidak ditemukan" }, { status: 404 });
    }
    await logAudit({
      action: "buku-tamu.cancel-checkin",
      entityType: "ReunionRegistration",
      entityId: registrationId,
      actorUserId: user.id,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Aksi tidak dikenal" }, { status: 400 });
}

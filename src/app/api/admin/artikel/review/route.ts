import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/admin/artikel/review - Approve or reject article (admin only)
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "BRANCH_ADMIN")) {
    return NextResponse.json({ error: "Hanya admin" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const { id, action, reviewNote } = body;

  if (!id || !action) {
    return NextResponse.json({ error: "ID dan action diperlukan" }, { status: 400 });
  }

  if (!["approve", "reject"].includes(action as string)) {
    return NextResponse.json({ error: "Action tidak valid" }, { status: 400 });
  }

  const existing = await prisma.article.findUnique({ where: { id: id as string } });
  if (!existing) {
    return NextResponse.json({ error: "Artikel tidak ditemukan" }, { status: 404 });
  }

  if (existing.status !== "PENDING") {
    return NextResponse.json(
      { error: "Hanya artikel dengan status PENDING yang bisa direview" },
      { status: 400 }
    );
  }

  const newStatus = action === "approve" ? "APPROVED" : "REJECTED";

  const article = await prisma.article.update({
    where: { id: id as string },
    data: {
      status: newStatus,
      reviewNote: reviewNote ? (reviewNote as string).trim() : null,
      reviewedByUserId: session.user.id,
      reviewedAt: new Date(),
      ...(newStatus === "APPROVED" && { publishedAt: new Date() }),
    },
    include: {
      category: { select: { name: true } },
      author: { select: { person: { select: { fullName: true } } } },
    },
  });

  await logAudit({
    action: action === "approve" ? "ARTICLE_APPROVE" : "ARTICLE_REJECT",
    entityType: "Article",
    entityId: article.id,
    beforeData: { status: "PENDING" },
    afterData: { status: newStatus, reviewNote: reviewNote || null },
    actorUserId: session.user.id,
  });

  return NextResponse.json(article);
}

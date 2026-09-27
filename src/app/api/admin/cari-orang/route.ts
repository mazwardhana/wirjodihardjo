import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdminScope, AuthorizationError } from "@/lib/rbac";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  try {
    const scope = await requireAdminScope(session.user.id);

    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? "";

    if (q.trim().length < 2) {
      return NextResponse.json([]);
    }

    const where: Record<string, unknown> = {
      deletedAt: null,
      OR: [
        { fullName: { contains: q, mode: "insensitive" } },
        { nickname: { contains: q, mode: "insensitive" } },
      ],
    };

    // Scope by branch for BRANCH_ADMIN
    if (scope.role === "BRANCH_ADMIN" && scope.branchId) {
      where.branchId = scope.branchId;
    }

    const persons = await prisma.person.findMany({
      where: where as any,
      select: { id: true, fullName: true },
      take: 10,
      orderBy: { fullName: "asc" },
    });

    return NextResponse.json(persons);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
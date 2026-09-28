import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AuthorizationError, requireAdminScope } from "@/lib/rbac";
import { getFamilyTreeData } from "@/lib/family-tree";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  try {
    const scope = await requireAdminScope(session.user.id);

    const url = new URL(request.url);
    const personId = url.searchParams.get("personId");
    if (!personId) {
      return NextResponse.json({ error: "personId diperlukan" }, { status: 400 });
    }

    const data = await getFamilyTreeData(personId, scope);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

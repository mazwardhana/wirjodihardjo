import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AuthorizationError } from "@/lib/rbac";
import { getKeluargaStats } from "../stats";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const branchId = url.searchParams.get("branchId");
    const result = await getKeluargaStats(session.user.id, branchId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

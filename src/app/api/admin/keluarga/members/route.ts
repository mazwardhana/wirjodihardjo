import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AuthorizationError } from "@/lib/rbac";
import { getKeluargaMembers } from "../members";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const result = await getKeluargaMembers(session.user.id, url.searchParams.get("branchId"), {
      gender: url.searchParams.get("gender"),
      generation: url.searchParams.get("generation"),
      status: url.searchParams.get("status"),
      q: url.searchParams.get("q"),
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

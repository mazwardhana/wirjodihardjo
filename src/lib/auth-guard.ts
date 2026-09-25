import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export type RequireRole = "SUPER_ADMIN" | "BRANCH_ADMIN" | "MEMBER";

/**
 * Memeriksa sesi dan peran user.
 * Jika tidak login → redirect ke /login
 * Jika role tidak sesuai → redirect ke /dashboard
 * Returns user data jika lolos.
 */
export async function requireRole(allowedRoles: RequireRole[], redirectTo = "/login") {
  const session = await auth();
  if (!session?.user) redirect(redirectTo);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, person: { select: { fullName: true } } },
  });
  if (!user) redirect(redirectTo);

  if (!allowedRoles.includes(user.role as RequireRole)) redirect("/dashboard");

  return { ...session.user, role: user.role, fullName: user.person.fullName };
}
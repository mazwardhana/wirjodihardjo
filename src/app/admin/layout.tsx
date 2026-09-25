import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Pembatas akses area admin.
 * Halaman /admin/* dibungkus layout ini agar selalu ada pemeriksaan peran
 * di sisi server (bukan hanya lewat proxy).
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "BRANCH_ADMIN")) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
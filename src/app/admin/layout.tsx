import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

/**
 * Layout admin dengan sidebar navigasi.
 * Halaman /admin/* dibungkus layout ini agar selalu ada pemeriksaan peran
 * di sisi server dan navigasi yang konsisten.
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
    select: {
      role: true,
      person: { select: { fullName: true } },
    },
  });

  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "BRANCH_ADMIN")) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar role={user.role} fullName={user.person.fullName} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
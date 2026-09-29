import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

// Detail cabang beralih ke segmen terpadu /admin/keluarga/cabang/[id].
// Gerbang otorisasi tetap: hanya SUPER_ADMIN yang lolos; sisanya dialihkan ke /dashboard.
export default async function AdminCabangDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "SUPER_ADMIN") redirect("/dashboard");

  const { id } = await params;
  redirect(`/admin/keluarga/cabang/${id}`);
}

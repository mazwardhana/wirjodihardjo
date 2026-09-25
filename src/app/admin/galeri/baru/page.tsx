import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AlbumForm } from "@/components/admin/AlbumForm";

export default async function AdminAlbumBaruPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "BRANCH_ADMIN")) {
    redirect("/dashboard");
  }

  return (
    <div className="p-8">
      <h1 className="font-display text-2xl font-semibold text-forest">Album Baru</h1>
      <p className="mt-1 text-sm text-muted">
        Buat album foto baru untuk mendokumentasikan acara atau momen keluarga.
      </p>

      <div className="mt-8 max-w-xl">
        <AlbumForm />
      </div>
    </div>
  );
}
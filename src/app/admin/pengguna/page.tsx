import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function AdminPenggunaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (admin?.role !== "SUPER_ADMIN") redirect("/dashboard");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { person: { select: { fullName: true } } },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-semibold text-forest">Kelola Pengguna</h1>
      <div className="mt-8 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-wood/15 text-xs font-medium uppercase tracking-wide text-muted">
              <th className="pb-3 pr-4">Nama</th>
              <th className="pb-3 pr-4">Email</th>
              <th className="pb-3 pr-4">Peran</th>
              <th className="pb-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-wood/10">
                <td className="py-3 pr-4 font-medium text-forest">{u.person.fullName}</td>
                <td className="py-3 pr-4 text-muted">{u.email}</td>
                <td className="py-3 pr-4 text-muted">{u.role}</td>
                <td className="py-3 text-muted">{u.isActive ? "Aktif" : "Nonaktif"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
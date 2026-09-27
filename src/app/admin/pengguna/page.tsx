import { auth } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PenggunaList } from "@/components/admin/PenggunaList";
import { FilterBar } from "@/components/admin/FilterBar";
import { PenggunaCreateModal } from "./PenggunaCreateModal";

const roleOptions = [
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "BRANCH_ADMIN", label: "Admin Cabang" },
  { value: "MEMBER", label: "Anggota" },
];

export default async function AdminPenggunaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; active?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (admin?.role !== "SUPER_ADMIN") redirect("/dashboard");

  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const role = sp.role?.trim() ?? "";
  const active = sp.active?.trim() ?? "";

  const where: Prisma.UserWhereInput = {};
  if (q) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { person: { fullName: { contains: q, mode: "insensitive" } } },
    ];
  }
  if (roleOptions.some((o) => o.value === role)) {
    where.role = role as Prisma.UserWhereInput["role"];
  }
  if (active === "true") where.isActive = true;
  if (active === "false") where.isActive = false;

  const [users, personsWithoutAccount] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        isVerified: true,
        person: { select: { id: true, fullName: true } },
      },
    }),
    prisma.person.findMany({
      where: { user: null, deletedAt: null },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-forest">Kelola Pengguna</h1>
          <p className="mt-2 text-sm text-muted">
            Kelola akun, peran, dan status verifikasi anggota keluarga.
          </p>
        </div>
        <PenggunaCreateModal persons={personsWithoutAccount} />
      </div>

      <div className="mt-6">
        <FilterBar
          config={{
            search: {
              placeholder: "Cari nama atau email...",
              param: "q",
            },
            filters: [
              {
                param: "role",
                label: "Peran",
                options: roleOptions,
              },
              {
                param: "active",
                label: "Status",
                options: [
                  { value: "true", label: "Aktif" },
                  { value: "false", label: "Nonaktif" },
                ],
              },
            ],
          }}
        />
      </div>

      <PenggunaList users={users} />
    </div>
  );
}

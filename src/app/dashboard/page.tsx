import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { getGenerationLabel } from "@/lib/generations";
import { recordUpcomingReunionReminders } from "@/lib/notifications";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      person: {
        select: {
          id: true,
          fullName: true,
          nickname: true,
          photoUrl: true,
          generationLevel: true,
        },
      },
    },
  });

  if (!user) redirect("/login");

  // Catat reminder reuni mendatang (idempoten)
  try { await recordUpcomingReunionReminders(user.id); } catch {}

  const [pendingCount, reunionCount, notificationCount] = await Promise.all([
    prisma.submission.count({
      where: { submittedByUserId: user.id, status: "PENDING" },
    }),
    prisma.reunionRegistration.count({
      where: { userId: user.id, status: "CONFIRMED" },
    }),
    prisma.notification.count({
      where: { userId: user.id, isRead: false },
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex items-center gap-4">
        <Avatar
          name={user.person.fullName}
          photoUrl={user.person.photoUrl}
          size="lg"
        />
        <div>
          <h1 className="font-display text-3xl font-semibold text-forest">
            {user.person.fullName}
          </h1>
          <p className="text-sm text-muted">
            {getGenerationLabel(user.person.generationLevel)}
            {user.person.nickname && ` (${user.person.nickname})`}
          </p>
          <p className="text-xs text-muted">
            {user.role === "SUPER_ADMIN"
              ? "Super Admin"
              : user.role === "BRANCH_ADMIN"
                ? "Admin Cabang"
                : "Anggota"}
          </p>
        </div>
      </div>

      {notificationCount > 0 && (
        <div className="mt-6 rounded-md border border-gold/40 bg-gold/10 p-4">
          <p className="text-sm font-medium text-forest">
            {notificationCount} notifikasi belum dibaca.{" "}
            <Link href="/dashboard/notifikasi" className="underline">
              Lihat
            </Link>
          </p>
        </div>
      )}

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <DashboardCard
          label="Pengajuan Saya"
          value={String(pendingCount)}
          description={pendingCount > 0 ? "Menunggu persetujuan" : "Tidak ada pengajuan tertunda"}
          href="/dashboard/pengajuan"
        />
        <DashboardCard
          label="Reuni Saya"
          value={String(reunionCount)}
          description={reunionCount > 0 ? "Reuni terdaftar" : "Belum mendaftar reuni"}
          href="/dashboard/reuni"
        />
        <DashboardCard
          label="Profil"
          value="Lengkapkan"
          description="Kelola profil dan data kontak"
          href="/dashboard/profil"
        />
      </div>

      {(user.role === "SUPER_ADMIN" || user.role === "BRANCH_ADMIN") && (
        <div className="mt-10 border-t border-wood/15 pt-6">
          <h2 className="font-display text-xl font-semibold text-forest">
            Panel Admin
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <AdminLink href="/admin/pengajuan" label="Pengajuan" />
            <AdminLink href="/admin/anggota" label="Data Anggota" />
            <AdminLink href="/admin/galeri" label="Moderasi Galeri" />
            <AdminLink href="/admin/hall-of-fame" label="Hall of Fame" />
            <AdminLink href="/admin/reuni" label="Kelola Reuni" />
            {user.role === "SUPER_ADMIN" && (
              <>
                <AdminLink href="/admin/cabang" label="Cabang" />
                <AdminLink href="/admin/pengguna" label="Pengguna" />
                <AdminLink href="/admin/audit-log" label="Audit Log" />
              </>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function DashboardCard({
  label,
  value,
  description,
  href,
}: {
  label: string;
  value: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-wood/20 bg-cream p-5 transition-colors hover:border-gold/60"
    >
      <div className="font-display text-3xl font-semibold text-forest">
        {value}
      </div>
      <p className="mt-1 text-sm font-medium text-wood">{label}</p>
      <p className="mt-1 text-xs text-muted">{description}</p>
    </Link>
  );
}

function AdminLink({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <Link
        href={href}
        className="block rounded-lg border border-wood/15 bg-cream px-4 py-3 text-sm font-medium text-forest transition-colors hover:border-gold/60"
      >
        {label}
      </Link>
    </li>
  );
}
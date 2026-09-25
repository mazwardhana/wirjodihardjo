import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import Link from "next/link";

export default async function DashboardNotifikasiPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  // Tandai sudah dibaca
  await prisma.notification.updateMany({
    where: { userId: session.user.id, isRead: false },
    data: { isRead: true },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-semibold text-forest">Notifikasi</h1>

      {notifications.length === 0 ? (
        <div className="mt-10">
          <EmptyState title="Tidak ada notifikasi" description="Notifikasi akan muncul saat ada aktivitas terkait akun Anda." />
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {notifications.map((n) => (
            <li key={n.id} className={`rounded-lg border p-4 ${n.isRead ? "border-wood/15 bg-cream" : "border-gold/40 bg-gold/5"}`}>
              <p className="font-semibold text-forest">{n.title}</p>
              {n.body && <p className="mt-1 text-sm text-muted">{n.body}</p>}
              {n.link && (
                <Link href={n.link} className="mt-2 inline-block text-sm font-medium text-gold-deep underline">
                  Lihat
                </Link>
              )}
              <p className="mt-1 text-xs text-muted">{new Date(n.createdAt).toLocaleDateString("id-ID")}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
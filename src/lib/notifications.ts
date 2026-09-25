import { prisma } from "@/lib/prisma";

/**
 * Buat notifikasi untuk seorang user.
 * Notifikasi di-dedup lewat kombinasi type + link supaya pemanggilan berulang
 * (mis. reminder reuni saat halaman dashboard dimuat) tidak menumpuk.
 */
export async function createNotification(params: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
}) {
  return prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      link: params.link,
    },
  });
}

async function notificationExists(params: {
  userId: string;
  type: string;
  link: string;
}) {
  const found = await prisma.notification.findFirst({
    where: { userId: params.userId, type: params.type, link: params.link },
    select: { id: true },
  });
  return found !== null;
}

/** Notifikasi status pengajuan untuk si pengaju. */
export async function notifySubmissionStatus(
  submissionId: string,
  status: "APPROVED" | "REJECTED",
  reviewNote?: string | null,
) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      type: true,
      submittedByUserId: true,
      targetPerson: { select: { fullName: true } },
    },
  });
  if (!submission) return;

  const typeLabel = submission.type.replace(/_/g, " ").toLowerCase();
  const whom = submission.targetPerson ? ` untuk ${submission.targetPerson.fullName}` : "";

  await createNotification({
    userId: submission.submittedByUserId,
    type: status === "APPROVED" ? "SUBMISSION_APPROVED" : "SUBMISSION_REJECTED",
    title: `Pengajuan ${typeLabel} ${status === "APPROVED" ? "disetujui" : "ditolak"}`,
    body:
      (status === "APPROVED"
        ? `Pengajuan Anda${whom} telah disetujui dan diterapkan.`
        : `Pengajuan Anda${whom} ditolak.`) + (reviewNote ? ` Catatan: ${reviewNote}` : ""),
    link: `/dashboard/pengajuan/${submission.id}`,
  });
}

/** Beri tahu admin ada pengajuan baru agar antrean tidak menganggur. */
export async function notifyAdminsOfNewSubmission(submissionId: string, type: string) {
  const admins = await prisma.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "BRANCH_ADMIN"] }, isActive: true },
    select: { id: true },
  });
  const typeLabel = type.replace(/_/g, " ").toLowerCase();
  for (const admin of admins) {
    await createNotification({
      userId: admin.id,
      type: "SUBMISSION_NEW",
      title: "Pengajuan baru menunggu",
      body: `Ada pengajuan ${typeLabel} yang perlu ditinjau.`,
      link: "/admin/pengajuan",
    });
  }
}

/** Notifikasi hasil moderasi media untuk pengunggahnya. */
export async function notifyMediaModeration(params: {
  mediaId: string;
  uploaderUserId: string | null;
  status: "APPROVED" | "REJECTED";
  albumTitle: string;
  reason?: string | null;
}) {
  if (!params.uploaderUserId) return;
  await createNotification({
    userId: params.uploaderUserId,
    type: params.status === "APPROVED" ? "MEDIA_APPROVED" : "MEDIA_REJECTED",
    title:
      params.status === "APPROVED"
        ? "Foto Anda telah tayang di galeri"
        : "Foto Anda belum disetujui",
    body:
      params.status === "APPROVED"
        ? `Unggahan Anda di album "${params.albumTitle}" sudah disetujui.`
        : `Unggahan Anda di album "${params.albumTitle}" ditolak.${params.reason ? ` Alasan: ${params.reason}` : ""}`,
    link: `/galeri`,
  });
}

/** Notifikasi ke peserta saat reuni diterbitkan atau berubah status. */
export async function notifyReunionPublished(reunionId: string) {
  const reunion = await prisma.reunion.findUnique({
    where: { id: reunionId },
    select: { title: true, startAt: true },
  });
  if (!reunion) return;

  const registrations = await prisma.reunionRegistration.findMany({
    where: { reunionId, status: { not: "CANCELLED" } },
    select: { userId: true },
  });

  for (const reg of registrations) {
    const link = `/dashboard/reuni`;
    if (await notificationExists({ userId: reg.userId, type: "REUNION_PUBLISHED", link })) continue;
    await createNotification({
      userId: reg.userId,
      type: "REUNION_PUBLISHED",
      title: `Reuni ${reunion.title} telah dipublikasikan`,
      body: "Jadwal dan lokasi resmi sudah bisa dilihat di halaman reuni.",
      link,
    });
  }
}

/**
 * Reminder reuni yang akan datang (dalam 7 hari).
 * Dipanggil dari halaman dashboard; idempoten lewat pengecekan notifikasi serupa.
 */
export async function recordUpcomingReunionReminders(userId: string) {
  const now = Date.now();
  const dalamTujuhHari = new Date(now + 7 * 24 * 60 * 60 * 1000);

  const registrations = await prisma.reunionRegistration.findMany({
    where: {
      userId,
      status: "CONFIRMED",
      reunion: {
        status: "PUBLISHED",
        startAt: { gte: new Date(now), lte: dalamTujuhHari },
      },
    },
    select: {
      id: true,
      reunion: { select: { id: true, slug: true, title: true, startAt: true, locationName: true } },
    },
  });

  for (const reg of registrations) {
    const link = `/reuni/${reg.reunion.slug}`;
    if (await notificationExists({ userId, type: "REUNION_REMINDER", link })) continue;
    await createNotification({
      userId,
      type: "REUNION_REMINDER",
      title: `Reuni ${reg.reunion.title} segera berlangsung`,
      body: `${new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeStyle: "short" }).format(
        reg.reunion.startAt,
      )}${reg.reunion.locationName ? ` · ${reg.reunion.locationName}` : ""}`,
      link,
    });
  }
}

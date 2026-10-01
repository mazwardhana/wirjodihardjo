import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  statusBadgeClass,
  submissionStatusLabel,
  submissionTypeLabel,
} from "../labels";

const backLinkCls =
  "inline-flex min-h-11 items-center text-sm font-medium text-gold-deep underline hover:text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest";

const GENDER_LABELS: Record<string, string> = {
  MALE: "Laki-laki",
  FEMALE: "Perempuan",
  OTHER: "Lainnya",
};

const PARENT_ROLE_LABELS: Record<string, string> = {
  FATHER: "Ayah",
  MOTHER: "Ibu",
  UNKNOWN: "Belum diketahui",
};

const PARTNER_STATUS_LABELS: Record<string, string> = {
  MARRIED: "Menikah",
  DIVORCED: "Bercerai",
  WIDOWED: "Duda / Janda",
  UNKNOWN: "Belum diketahui",
};

const STATUS_HINTS: Record<string, string> = {
  PENDING: "Pengajuan ini sedang menunggu tinjauan admin.",
  APPROVED: "Pengajuan ini sudah disetujui dan diterapkan pada data silsilah.",
  REJECTED: "Pengajuan ini ditolak admin. Lihat catatan di bawah.",
  CANCELLED: "Pengajuan ini dibatalkan.",
};

const RELATION_TYPE_LABELS: Record<string, string> = {
  parent: "Orang Tua",
  child: "Anak",
  partner: "Pasangan",
};

const ACTION_LABELS: Record<string, string> = {
  add: "Tambah",
  remove: "Hapus",
  update: "Ubah",
};

/** Nama field payload -> label Bahasa Indonesia. */
const PAYLOAD_LABELS: Record<string, string> = {
  parentId: "ID Orang Tua",
  personId: "ID Anggota Terkait",
  targetPersonId: "ID Anggota Target",
  edgeId: "ID Relasi",
  branchId: "ID Keluarga Cabang",
  fullName: "Nama Lengkap",
  nickname: "Nickname",
  namaPanggilan: "Nama Panggilan",
  gender: "Jenis Kelamin",
  birthDate: "Tanggal Lahir",
  birthPlace: "Tempat Lahir",
  deathDate: "Tanggal Wafat",
  isDeceased: "Sudah wafat",
  bio: "Biografi",
  isStep: "Anak tiri",
  isAdopted: "Anak angkat",
  parentRole: "Peran Orang Tua",
  role: "Peran",
  marriageDate: "Tanggal Menikah",
  status: "Status Pernikahan",
  orderIndex: "Urutan",
  relationType: "Jenis Relasi",
  action: "Aksi",
  partnerGender: "Jenis Kelamin Pasangan",
};

function payloadLabel(key: string): string {
  return PAYLOAD_LABELS[key] ?? key;
}

/** Format nilai payload supaya nilai enum tidak tampil mentah. */
function payloadValue(key: string, value: unknown): string {
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  if (typeof value === "number") return String(value);
  if (value === null || value === undefined) return "-";

  if (typeof value === "object") return JSON.stringify(value);

  const text = String(value);
  if (key === "gender" || key === "partnerGender") {
    return GENDER_LABELS[text] ?? text;
  }
  if (key === "parentRole" || key === "role") {
    return PARENT_ROLE_LABELS[text] ?? text;
  }
  if (key === "status") {
    return PARTNER_STATUS_LABELS[text] ?? text;
  }
  if (key === "relationType") {
    return RELATION_TYPE_LABELS[text] ?? text;
  }
  if (key === "action") {
    return ACTION_LABELS[text] ?? text;
  }
  if (key.endsWith("Date") && text) {
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("id-ID", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
  }
  return text;
}

function PayloadList({ payload }: { payload: Record<string, unknown> }) {
  const entries = Object.entries(payload).filter(
    ([, value]) => value !== null && value !== undefined && value !== "",
  );

  if (entries.length === 0) {
    return (
      <p className="mt-3 text-sm text-muted">Tidak ada data pada pengajuan ini.</p>
    );
  }

  return (
    <dl className="mt-3 space-y-3 text-sm">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="flex justify-between gap-6 border-b border-wood/10 pb-2"
        >
          <dt className="text-muted">{payloadLabel(key)}</dt>
          <dd className="text-right font-medium text-forest">
            {payloadValue(key, value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default async function PengajuanDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sukses?: string }>;
}) {
  const { id } = await params;
  const { sukses } = await searchParams;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const submission = await prisma.submission.findUnique({
    where: { id },
    include: {
      targetPerson: {
        select: { id: true, fullName: true, deletedAt: true },
      },
      submitter: { select: { person: { select: { fullName: true } } } },
      reviewer: { select: { person: { select: { fullName: true } } } },
    },
  });

  // Bukan pengajuan milik anggota ini: jangan sampai buntu di halaman 404
  // global tanpa jalan kembali.
  if (!submission || submission.submittedByUserId !== session.user.id) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        <Link href="/dashboard/pengajuan" className={backLinkCls}>
          Kembali
        </Link>
        <div className="mt-6">
          <EmptyState
            title="Pengajuan tidak ditemukan"
            description="Pengajuan ini tidak ada atau bukan bagian dari pengajuan Anda."
            action={
              <Link
                href="/dashboard/pengajuan"
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-forest px-4 py-2 text-sm font-semibold text-cream hover:bg-forest/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
              >
                Lihat Pengajuan Saya
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const payload =
    typeof submission.payload === "object" &&
    submission.payload !== null &&
    !Array.isArray(submission.payload)
      ? (submission.payload as Record<string, unknown>)
      : {};

  const hint = STATUS_HINTS[submission.status] ?? "";

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/dashboard/pengajuan" className={backLinkCls}>
        Kembali ke Daftar Pengajuan
      </Link>

      {sukses === "1" && (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 rounded-md border border-gold/40 bg-gold/10 p-4"
        >
          <p className="text-sm font-semibold text-forest">
            Pengajuan berhasil diajukan.
          </p>
          <p className="mt-1 text-sm text-muted">
            Pengajuan Anda sedang menunggu tinjauan admin. Anda akan
            menerima notifikasi setelah diproses.
          </p>
        </div>
      )}

      <div className="mt-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-semibold text-forest">
            {submissionTypeLabel(submission.type)}
          </h1>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass(
              submission.status,
            )}`}
          >
            {submissionStatusLabel(submission.status)}
          </span>
        </div>
        {hint && <p className="mt-2 text-sm text-muted">{hint}</p>}

        <dl className="mt-6 space-y-4 text-sm">
          <div className="flex justify-between border-b border-wood/10 pb-3">
            <dt className="text-muted">Diajukan oleh</dt>
            <dd className="font-medium text-forest">
              {submission.submitter.person.fullName}
            </dd>
          </div>
          {submission.targetPerson && (
            <div className="flex justify-between border-b border-wood/10 pb-3">
              <dt className="text-muted">Terkait</dt>
              <dd className="font-medium text-forest">
                {submission.targetPerson.deletedAt ? (
                  // Tautan ke profil seseorang yang sudah dihapus akan 404.
                  submission.targetPerson.fullName
                ) : (
                  <Link
                    href={`/profil/${submission.targetPerson.id}`}
                    className="underline hover:text-gold-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                  >
                    {submission.targetPerson.fullName}
                  </Link>
                )}
              </dd>
            </div>
          )}
          <div className="flex justify-between border-b border-wood/10 pb-3">
            <dt className="text-muted">Tanggal</dt>
            <dd className="font-medium text-forest">
              {new Date(submission.createdAt).toLocaleDateString("id-ID", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </dd>
          </div>
          {submission.reviewer && (
            <div className="flex justify-between border-b border-wood/10 pb-3">
              <dt className="text-muted">Diproses oleh</dt>
              <dd className="font-medium text-forest">
                {submission.reviewer.person.fullName}
              </dd>
            </div>
          )}
          {submission.reviewedAt && (
            <div className="flex justify-between border-b border-wood/10 pb-3">
              <dt className="text-muted">Diproses pada</dt>
              <dd className="font-medium text-forest">
                {new Date(submission.reviewedAt).toLocaleDateString("id-ID", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </dd>
            </div>
          )}
          {submission.reviewNote && (
            <div className="flex justify-between border-b border-wood/10 pb-3">
              <dt className="text-muted">Catatan</dt>
              <dd className="max-w-xs text-right font-medium text-wood">
                {submission.reviewNote}
              </dd>
            </div>
          )}
        </dl>

        <div className="mt-8">
          <h2 className="font-display text-lg font-semibold text-forest">
            Data yang Diajukan
          </h2>
          <PayloadList payload={payload} />
        </div>

        <div className="mt-8">
          <Link
            href="/dashboard/pengajuan"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-wood/30 px-5 py-2.5 text-sm font-semibold text-forest hover:bg-wood/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            Lihat Semua Pengajuan
          </Link>
        </div>
      </div>
    </div>
  );
}

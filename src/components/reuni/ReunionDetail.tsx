import Image from "next/image";
import Link from "next/link";
import { formatDate, formatDateTime } from "@/lib/utils";
import { RegistrationButton } from "@/components/reuni/RegistrationButton";

type ReunionStatus = "DRAFT" | "PUBLISHED" | "CANCELLED" | "COMPLETED";

export type ReunionDetailData = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  startAt: Date;
  endAt: Date | null;
  locationName: string | null;
  locationUrl: string | null;
  capacity: number | null;
  registrationDeadline: Date | null;
  heroImageUrl: string | null;
  status: ReunionStatus;
};

const statusMeta: Record<ReunionStatus, { label: string; className: string }> = {
  DRAFT: { label: "Draf", className: "bg-muted/10 text-muted" },
  PUBLISHED: { label: "Pendaftaran dibuka", className: "bg-forest/10 text-forest" },
  CANCELLED: { label: "Dibatalkan", className: "bg-wood/10 text-wood" },
  COMPLETED: { label: "Sudah berlangsung", className: "bg-gold/20 text-gold-deep" },
};

/**
 * Detail satu reuni. Halaman /reuni/[slug] yang memuat data reuni dan
 * pendaftaran pengunjung, komponen ini hanya menyusun tampilannya.
 */
export function ReunionDetail({
  reunion,
  attendeeCount,
  registration,
  isLoggedIn,
}: {
  reunion: ReunionDetailData;
  attendeeCount: number;
  registration: { status: string; guestCount: number } | null;
  isLoggedIn: boolean;
}) {
  const now = new Date();
  const deadlinePassed =
    reunion.registrationDeadline !== null &&
    new Date(reunion.registrationDeadline) < now;
  const isOpen =
    reunion.status === "PUBLISHED" && new Date(reunion.startAt) > now && !deadlinePassed;
  const isFull = reunion.capacity !== null && attendeeCount >= reunion.capacity;
  const status = statusMeta[reunion.status];

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Link
        href="/reuni"
        className="text-sm text-muted transition-colors hover:text-forest"
      >
        ← Kembali ke jadwal reuni
      </Link>

      {reunion.heroImageUrl && (
        <div className="relative mt-6 aspect-[21/9] w-full overflow-hidden rounded-lg border border-wood/15 bg-parchment">
          <Image
            src={reunion.heroImageUrl}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
          />
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${status.className}`}>
          {status.label}
        </span>
        {reunion.status === "PUBLISHED" && reunion.registrationDeadline && (
          <span className="text-xs text-muted">
            {deadlinePassed
              ? "Batas pendaftaran lewat"
              : `Daftar sebelum ${formatDate(reunion.registrationDeadline)}`}
          </span>
        )}
      </div>

      <h1 className="mt-3 font-display text-3xl font-semibold text-forest sm:text-4xl">
        {reunion.title}
      </h1>

      <dl className="mt-6 space-y-3 border-y border-wood/15 py-6 text-sm">
        <div className="flex flex-wrap gap-x-3">
          <dt className="min-w-24 font-medium text-forest">Waktu</dt>
          <dd className="text-muted">
            {formatDateTime(reunion.startAt)}
            {reunion.endAt ? ` s/d ${formatDateTime(reunion.endAt)}` : ""}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-3">
          <dt className="min-w-24 font-medium text-forest">Lokasi</dt>
          <dd className="text-muted">
            {reunion.locationName ? (
              reunion.locationUrl ? (
                <a
                  href={reunion.locationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-gold/60 underline-offset-2 transition-colors hover:text-forest"
                >
                  {reunion.locationName}
                </a>
              ) : (
                reunion.locationName
              )
            ) : (
              "Menyusul"
            )}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-3">
          <dt className="min-w-24 font-medium text-forest">Kehadiran</dt>
          <dd className="text-muted">
            {attendeeCount} orang
            {reunion.capacity ? ` dari kuota ${reunion.capacity}` : ""}
          </dd>
        </div>
      </dl>

      {reunion.description && (
        <div className="mt-6 whitespace-pre-line leading-relaxed text-wood">
          {reunion.description}
        </div>
      )}

      {reunion.status === "PUBLISHED" ? (
        <div className="mt-8">
          <RegistrationButton
            reunionId={reunion.id}
            isOpen={isOpen}
            isFull={isFull}
            deadlinePassed={deadlinePassed}
            registration={registration}
            isLoggedIn={isLoggedIn}
          />
        </div>
      ) : reunion.status === "CANCELLED" ? (
        <p className="mt-8 rounded-lg border border-wood/30 bg-wood/5 px-5 py-4 text-sm text-wood">
          Reuni ini dibatalkan. Bila Anda sudah mendaftar, hubungi panitia untuk
          pertanyaan lebih lanjut.
        </p>
      ) : (
        <p className="mt-8 rounded-lg border border-dashed border-wood/30 bg-parchment/40 px-5 py-4 text-sm text-muted">
          Pendaftaran untuk reuni ini belum dibuka.
        </p>
      )}
    </article>
  );
}
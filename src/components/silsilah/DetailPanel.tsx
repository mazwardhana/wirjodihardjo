"use client";

import Link from "next/link";
import { Dialog } from "@/components/ui/Dialog";
import { Avatar } from "@/components/ui/Avatar";
import { getGenerationLabel } from "@/lib/generations";
import type { PublicPerson } from "@/lib/data";
import { formatDate } from "@/lib/utils";

/**
 * Detail anggota silsilah.
 * Memakai Dialog bersama: modal di desktop, bottom-sheet di mobile,
 * lengkap dengan jebakan fokus, tombol Esc, dan pengunci gulir halaman.
 */
export function DetailPanel({
  person,
  isAuthenticated,
  onClose,
}: {
  person: PublicPerson;
  isAuthenticated: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog
      open
      onClose={onClose}
      title={person.fullName}
      description="Profil publik dan hubungan keluarga anggota."
      size="md"
    >
      <div className="flex items-center gap-4">
        <Avatar name={person.fullName} photoUrl={person.photoUrl} size="lg" />
        {person.nickname && (
          <p className="text-sm text-muted">Nama panggilan: {person.nickname}</p>
        )}
      </div>

      <dl className="mt-5 space-y-3 text-sm">
        <Row
          label="Generasi"
          value={getGenerationLabel(person.generationLevel)}
        />
        {person.branch && <Row label="Cabang" value={person.branch.name} />}
        <Row
          label="Status"
          value={person.isDeceased ? "Almarhum/Almarhumah" : "Masih hidup"}
        />
        {person.birthDate && (
          <Row label="Tanggal lahir" value={formatDate(person.birthDate)} />
        )}
        {person.birthPlace && (
          <Row label="Tempat lahir" value={person.birthPlace} />
        )}
      </dl>

      {person.bio && (
        <p className="mt-5 text-sm leading-relaxed text-muted">{person.bio}</p>
      )}

      {/* Data sensitif: hanya tampil penuh setelah login, di halaman profil */}
      <div className="mt-6 rounded-md border border-wood/20 bg-parchment/50 p-4">
        {isAuthenticated ? (
          <p className="text-sm text-muted">
            Buka halaman profil lengkap untuk melihat informasi kontak.
          </p>
        ) : (
          <p className="text-sm text-muted">
            Informasi kontak hanya tersedia untuk anggota yang login.
          </p>
        )}
        <Link
          href={`/profil/${person.id}`}
          className="mt-3 inline-flex h-10 items-center rounded-md bg-forest px-4 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft"
        >
          Buka profil lengkap
        </Link>
      </div>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-forest">{value}</dd>
    </div>
  );
}

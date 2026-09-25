"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { getGenerationLabel } from "@/lib/generations";
import type { PublicPerson } from "@/lib/data";
import { formatDate } from "@/lib/utils";

export function DetailPanel({
  person,
  isAuthenticated,
  onClose,
}: {
  person: PublicPerson;
  isAuthenticated: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      {/* Latar gelap, klik untuk menutup */}
      <button
        type="button"
        aria-label="Tutup panel detail"
        onClick={onClose}
        className="absolute inset-0 z-10 cursor-default bg-ink/20"
      />

      <aside
        role="dialog"
        aria-modal="false"
        aria-label={`Detail ${person.fullName}`}
        className="absolute right-0 top-0 z-20 h-full w-full max-w-sm overflow-y-auto border-l border-wood/25 bg-cream shadow-xl"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-wood/15 bg-cream px-5 py-4">
          <h2 className="font-display text-lg font-semibold text-forest">
            Detail Anggota
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="grid h-9 w-9 place-items-center rounded-md text-muted hover:bg-wood/10"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-4">
            <Avatar name={person.fullName} photoUrl={person.photoUrl} size="lg" />
            <div>
              <h3 className="font-display text-xl font-semibold text-forest">
                {person.fullName}
              </h3>
              {person.nickname && (
                <p className="text-sm text-muted">{person.nickname}</p>
              )}
            </div>
          </div>

          <dl className="mt-5 space-y-3 text-sm">
            <Row label="Generasi" value={getGenerationLabel(person.generationLevel)} />
            {person.branch && <Row label="Cabang" value={person.branch.name} />}
            <Row
              label="Status"
              value={person.isDeceased ? "Almarhum/Almarhumah" : "Masih hidup"}
            />
            {person.birthDate && (
              <Row label="Lahir" value={formatDate(person.birthDate)} />
            )}
            {person.birthPlace && <Row label="Tempat lahir" value={person.birthPlace} />}
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
        </div>
      </aside>
    </>
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
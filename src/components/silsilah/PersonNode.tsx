"use client";

import { createContext, memo, useContext, type ComponentType } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  FaFacebookF,
  FaInstagram,
  FaLinkedinIn,
  FaTiktok,
} from "react-icons/fa6";
import { getGenerationLabel } from "@/lib/generations";
import { calculateAge, isSafeUrl } from "@/lib/profile";
import { initials } from "@/lib/utils";
import type { PublicPerson } from "@/lib/data";

export type PersonNodeData = {
  person: PublicPerson;
  childCount: number;
  hasHiddenChildren: boolean;
  collapsed: boolean;
  partnerStatus: "MARRIED" | "DIVORCED" | "WIDOWED" | "UNKNOWN" | null;
};

/** Aksi tombol info (buka detail) yang diberikan oleh FamilyTreeCanvas. */
export type PersonNodeActions = {
  openDetail: (person: PublicPerson) => void;
};

export const PersonNodeActionsContext =
  createContext<PersonNodeActions | null>(null);

const statusBadge: Record<string, { label: string; cls: string }> = {
  MARRIED: {
    label: "Menikah",
    cls: "bg-gold/15 text-gold-deep border-gold/30",
  },
  DIVORCED: {
    label: "Cerai",
    cls: "bg-red-100/60 text-red-700 border-red-300/50",
  },
  WIDOWED: {
    label: "Alm./Almh.",
    cls: "bg-wood/10 text-wood-soft border-wood/20",
  },
  UNKNOWN: {
    label: "?",
    cls: "bg-muted/10 text-muted border-muted/20",
  },
};

const socialIcons: Record<string, ComponentType<{ className?: string }>> = {
  instagram: FaInstagram,
  facebook: FaFacebookF,
  linkedin: FaLinkedinIn,
  tiktok: FaTiktok,
};

/** Label umur, memakai deathDate sebagai acuan bila orangnya sudah wafat. */
function ageLabel(person: PublicPerson): string | null {
  if (!person.birthDate) return null;
  if (person.isDeceased) {
    // Tanpa deathDate umur tidak bisa dihitung, jadi jangan tampilkan usia
    // yang terus bertambah; penanda wafat sudah ada di kartu.
    if (!person.deathDate) return null;
    const age = calculateAge(person.birthDate, person.deathDate);
    return age === null ? null : `wafat usia ${age} tahun`;
  }
  const age = calculateAge(person.birthDate);
  return age === null ? null : `usia ${age} tahun`;
}

/**
 * Isi kartu profil, komponen murni agar mudah diuji tanpa konteks React Flow.
 * `onOpenDetail` opsional: bila kosong tombol info tidak ditampilkan.
 */
export function PersonNodeCard({
  data,
  selected,
  onOpenDetail,
}: {
  data: PersonNodeData;
  selected?: boolean;
  onOpenDetail?: (person: PublicPerson) => void;
}) {
  const { person, childCount, hasHiddenChildren, partnerStatus } = data;
  const badge = partnerStatus ? statusBadge[partnerStatus] : null;

  const birthYear = person.birthDate
    ? String(new Date(person.birthDate).getFullYear())
    : null;
  const shortInfo = [
    getGenerationLabel(person.generationLevel),
    birthYear,
    person.branch?.name ?? null,
  ]
    .filter(Boolean)
    .join(" · ");
  const age = ageLabel(person);
  // Tautan sosial dari pohon tidak melewati proyeksi profil, jadi saring
  // protokol di sini: hanya http(s) yang boleh jadi href.
  const safeSocialLinks = person.socialLinks.filter((link) => isSafeUrl(link.url));

  return (
    <div
      className={`w-[260px] rounded-lg border bg-cream px-3 py-2.5 shadow-sm transition-all ${
        selected
          ? "border-gold ring-2 ring-gold/40"
          : "border-wood/25 hover:border-gold/60"
      } ${person.isDeceased ? "opacity-80" : ""}`}
    >
      <div className="flex items-center gap-2">
        {person.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={person.photoUrl}
            alt=""
            className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-gold/40"
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-forest/10 text-[10px] font-semibold text-forest ring-1 ring-forest/15"
          >
            {initials(person.fullName)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight text-forest">
            {person.fullName}
          </p>
          <p className="text-[10px] font-medium text-wood">
            {[shortInfo, age].filter(Boolean).join(" · ")}
          </p>
        </div>

        {onOpenDetail && (
          /*
            Tombol info: memiliki handler eksplisit sehingga membuka detail
            orang ini tanpa bergantung pada event bubbling ke node wrapper.
            Diletakkan di luar elemen interaktif lain dan diberi kelas nodrag
            agar tidak mengganggu React Flow.
          */
          <button
            type="button"
            aria-label={`Lihat detail ${person.fullName}`}
            className="nodrag -mr-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-forest/60 transition-colors hover:bg-forest/10 hover:text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            onClick={() => onOpenDetail(person)}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </button>
        )}
      </div>

      {safeSocialLinks.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {safeSocialLinks.map((link) => {
            const Icon = socialIcons[(link.platform.iconName ?? "").toLowerCase()];
            return (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={link.platform.name}
                className="nodrag grid h-5 w-5 place-items-center rounded-full text-forest/70 transition-colors hover:bg-forest/10 hover:text-forest"
              >
                {Icon ? (
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-forest/60"
                  />
                )}
              </a>
            );
          })}
        </div>
      )}

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {person.isDeceased && (
          <span className="rounded-full bg-muted/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted">
            Almarhum
          </span>
        )}
        {badge && (
          <span
            className={`rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${badge.cls}`}
          >
            {badge.label}
          </span>
        )}
        {childCount > 0 && (
          <span className="ml-auto rounded-full bg-forest/10 px-1.5 py-0.5 text-[9px] font-medium text-forest">
            {hasHiddenChildren
              ? `${childCount} disembunyikan`
              : `${childCount} anak`}
          </span>
        )}
      </div>
    </div>
  );
}

function PersonNodeComponent({ data, selected }: NodeProps) {
  const d = data as unknown as PersonNodeData;
  const actions = useContext(PersonNodeActionsContext);
  return (
    <div className="relative">
      <Handle
        id="bus"
        type="target"
        position={Position.Top}
        className="!h-1.5 !w-1.5 !border-0 !bg-wood/40"
      />
      <PersonNodeCard
        data={d}
        selected={selected}
        onOpenDetail={actions?.openDetail}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-1.5 !w-1.5 !border-0 !bg-wood/40"
      />
    </div>
  );
}

export const PersonNode = memo(PersonNodeComponent);

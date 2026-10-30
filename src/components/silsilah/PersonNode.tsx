"use client";

import { createContext, memo, useCallback, useContext, type ComponentType } from "react";
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

/** Aksi kartu orang: buka detail, lipat/buka cabang, fokus ke orang ini. */
export type PersonNodeActions = {
  openDetail: (person: PublicPerson) => void;
  toggleCollapse: (personId: string) => void;
  focusPerson: (personId: string) => void;
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

/** Tahun lahir–wafat ringkas; tahun tunggal bila salah satunya kosong. */
function yearSpan(person: PublicPerson): string | null {
  const birth = person.birthDate
    ? String(new Date(person.birthDate).getFullYear())
    : null;
  if (!person.isDeceased) return birth;
  const death = person.deathDate
    ? String(new Date(person.deathDate).getFullYear())
    : null;
  if (birth && death) return `${birth}–${death}`;
  return death ? `wafat ${death}` : birth;
}

/**
 * Isi kartu profil, komponen murni agar mudah diuji tanpa konteks React Flow.
 * `onOpenDetail` opsional: bila kosong tombol info tidak ditampilkan.
 */
export function PersonNodeCard({
  data,
  selected,
  onOpenDetail,
  onToggleCollapse,
  onFocusPerson,
}: {
  data: PersonNodeData;
  selected?: boolean;
  onOpenDetail?: (person: PublicPerson) => void;
  onToggleCollapse?: (personId: string) => void;
  onFocusPerson?: (personId: string) => void;
}) {
  const { person, childCount, hasHiddenChildren, collapsed, partnerStatus } = data;
  const badge = partnerStatus ? statusBadge[partnerStatus] : null;
  const years = yearSpan(person);
  const age = ageLabel(person);
  const genLabel = getGenerationLabel(person.generationLevel);
  // Tautan sosial dari pohon tidak melewati proyeksi profil, jadi saring
  // protokol di sini: hanya http(s) yang boleh jadi href.
  const safeSocialLinks = person.socialLinks.filter((link) => isSafeUrl(link.url));

  // Baris meta pendek: generasi lalu tahun. Umur hanya bila muat.
  const metaLine = [genLabel, years].filter(Boolean).join(" · ");
  const subLine = age;

  return (
    <div
      className={`relative w-[168px] rounded-md border bg-cream px-2.5 py-2 shadow-sm transition-all ${
        selected
          ? "border-gold ring-2 ring-gold/40"
          : "border-wood/25 hover:border-gold/60"
      } ${person.isDeceased ? "opacity-80" : ""}`}
    >
      <div className="flex items-start gap-2">
        {person.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={person.photoUrl}
            alt=""
            width={32}
            height={32}
            loading="lazy"
            className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-gold/40"
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-forest/10 text-[11px] font-semibold text-forest ring-1 ring-forest/15"
          >
            {initials(person.fullName)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[13px] font-semibold leading-[1.15] text-forest">
            {person.fullName}
          </p>
          <p className="mt-0.5 text-[11px] font-medium leading-tight text-wood tabular-nums">
            {metaLine}
          </p>
          {subLine && (
            <p className="text-[11px] leading-tight text-muted">{subLine}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-center gap-1">
          {onFocusPerson && (
            /*
              Tombol fokus: menempatkan orang ini sebagai pusat kanvas supaya
              pengguna HP bisa “menancapkan” diri tanpa pan manual.
            */
            <button
              type="button"
              aria-label={`Fokus ke ${person.fullName}`}
              className="nodrag grid h-7 w-7 place-items-center rounded-full text-forest/60 transition-colors hover:bg-forest/10 hover:text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              onClick={() => onFocusPerson(person.id)}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="7" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
              </svg>
            </button>
          )}

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
              className="nodrag grid h-7 w-7 place-items-center rounded-full text-forest/60 transition-colors hover:bg-forest/10 hover:text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              onClick={() => onOpenDetail(person)}
            >
              <svg
                width="14"
                height="14"
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
      </div>

      {safeSocialLinks.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center gap-1">
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

      <div className="mt-1 flex flex-wrap items-center gap-1">
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
          <span className="ml-auto rounded-full bg-forest/10 px-1.5 py-0.5 text-[9px] font-medium text-forest tabular-nums">
            {hasHiddenChildren
              ? `${childCount} disembunyikan`
              : `${childCount} anak`}
          </span>
        )}
      </div>

      {/*
        Lipat/buka cabang: tombol eksplisit di tepi bawah kartu (target sentuh
        44px agar nyaman di HP), bukan hanya klik ganda. Padanan keyboard
        ditangani di wrapper node di bawah.
      */}
      {childCount > 0 && onToggleCollapse && (
        <button
          type="button"
          aria-label={
            collapsed
              ? `Buka cabang ${person.fullName}`
              : `Lipat cabang ${person.fullName}`
          }
          aria-expanded={!collapsed}
          data-testid={`collapse-${person.id}`}
          className="nodrag absolute -bottom-3 left-1/2 flex h-6 w-11 -translate-x-1/2 items-center justify-center rounded-full border border-wood/30 bg-parchment text-forest shadow-sm transition-colors hover:border-gold/60 hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          onClick={() => onToggleCollapse(person.id)}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {collapsed ? (
              <path d="M6 9l6 6 6-6" />
            ) : (
              <path d="M6 15l6-6 6 6" />
            )}
          </svg>
        </button>
      )}
    </div>
  );
}

function PersonNodeComponent({ data, selected }: NodeProps) {
  const d = data as unknown as PersonNodeData;
  const actions = useContext(PersonNodeActionsContext);

  // Padanan keyboard untuk tombol di kartu. React Flow sudah menangani panah
  // untuk pan kanvas pada wrapper node, jadi ArrowLeft/ArrowRight di sini
  // dipakai untuk geser fokus antar saudara/keluarga yang tampil.
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        // Enter/Space di wrapper kartu = buka detail (padanan klik kartu).
        event.preventDefault();
        actions?.openDetail(d.person);
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        actions?.focusPerson(d.person.id);
      }
    },
    [actions, d.person],
  );

  return (
    <div
      className="relative outline-none"
      role="group"
      aria-label={`Kartu ${d.person.fullName}`}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
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
        onToggleCollapse={actions?.toggleCollapse}
        onFocusPerson={actions?.focusPerson}
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

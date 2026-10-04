"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import type { RegistrationBranch, RegistrationRowError } from "@/lib/registrasi";

/* ─────────────────────────────────────────────────────────────
   Konsep: "Buku Besar Keluarga", halaman buku tulis yang diisi
   tangan. Kertas krem, garis tipis, nomor urut di gutter seperti buku kas,
   dan satu aksen emas pada momen yang penting (garis fokus dan segel
   pencatatan). Tidak ada kartu dekoratif: yang diberi bentuk adalah isi
   bukunya sendiri.
   ───────────────────────────────────────────────────────────── */

export type LedgerRow = {
  namaPanggilan: string;
  namaLengkap: string;
  /**
   * Kosong berarti belum dipilih. Sengaja tidak ada nilai bawaan: arsip
   * keluarga adalah catatan permanen, jadi lebih baik form menolak kirim
   * daripada diam-diam mencatat orang sebagai laki-laki.
   */
  gender: "" | "L" | "P";
  status: "ALIVE" | "DECEASED";
  hadir: boolean;
};

/** Baris yang benar-benar dikirim ke server, lengkap dengan indeks UI-nya. */
export type SubmittedRow = { row: LedgerRow; uiIndex: number };

/** Satu pesan error yang sudah dipetakan ke baris dan field di form. */
export type RowFieldError = { rowIndex: number; field: string; message: string };

/**
 * Batas keras baris, dicerminkan dari `MAX_ROWS` di `@/lib/registrasi`.
 * Modul itu tidak bisa di-import sebagai nilai di komponen client karena
 * menarik `bcryptjs` ke bundel browser; konstanta yang sama dijaga oleh
 * assertion di `page.test.ts`.
 */
export const MAX_LEDGER_ROWS = 50;

/** Baris kosong yang disiapkan lebih dulu, supaya buku tidak terlihat lapang. */
export const INITIAL_LEDGER_ROWS = 5;

export function createLedgerRow(overrides: Partial<LedgerRow> = {}): LedgerRow {
  return {
    namaPanggilan: "",
    namaLengkap: "",
    gender: "",
    status: "ALIVE",
    hadir: false,
    ...overrides,
  };
}

export function createLedgerRows(count: number = INITIAL_LEDGER_ROWS): LedgerRow[] {
  return Array.from({ length: count }, () => createLedgerRow());
}

/**
 * Baris kosong diabaikan server; baris yang terisi sebagian jadi error.
 * Aturan yang sama dipakai client supaya bawaan form tidak berbohong.
 */
export function isRowEmpty(row: LedgerRow): boolean {
  return row.namaPanggilan.trim() === "" && row.namaLengkap.trim() === "";
}

export function submittedRows(rows: LedgerRow[]): SubmittedRow[] {
  const kept: SubmittedRow[] = [];
  rows.forEach((row, uiIndex) => {
    if (!isRowEmpty(row)) kept.push({ row, uiIndex });
  });
  return kept;
}

/** Satu baris yang terisi sebagian: server akan menolaknya. */
export function isRowPartial(row: LedgerRow): boolean {
  return !isRowEmpty(row) && (row.namaPanggilan.trim() === "" || row.namaLengkap.trim() === "");
}

/** Yang dihitung sebagai peserta reuni: hadir dan masih hidup. */
export function attendeeCount(rows: LedgerRow[]): number {
  return submittedRows(rows).filter(
    ({ row }) => row.hadir && row.status === "ALIVE",
  ).length;
}

export function toPayloadRows(rows: LedgerRow[]): LedgerRow[] {
  return submittedRows(rows).map(({ row }) => ({
    namaPanggilan: row.namaPanggilan.trim(),
    namaLengkap: row.namaLengkap.trim(),
    gender: row.gender,
    status: row.status,
    hadir: row.hadir,
  }));
}

export function filterBranches(
  branches: RegistrationBranch[],
  query: string,
): RegistrationBranch[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return branches;
  return branches.filter((branch) => branch.name.toLowerCase().includes(needle));
}

/**
 * Error dari server memakai indeks baris yang dikirim (baris kosong sudah
 * dibuang), jadi pemetaan balik perlu tahu baris mana yang ikut terkirim.
 * Error `field: "rows"` tidak punya baris dan jadi error tingkat form.
 */
export function mapServerErrors(
  errors: RegistrationRowError[] | undefined,
  submitted: SubmittedRow[],
): { rowErrors: RowFieldError[]; formError: string | null } {
  const rowErrors: RowFieldError[] = [];
  let formError: string | null = null;

  for (const err of errors ?? []) {
    if (!err || err.field === "rows") {
      formError ??= err?.message ?? null;
      continue;
    }
    const target = submitted[err.index];
    if (!target) continue;
    rowErrors.push({ rowIndex: target.uiIndex, field: err.field, message: err.message });
  }

  return { rowErrors, formError };
}

export function fieldErrorOf(
  rowErrors: RowFieldError[],
  rowIndex: number,
  field: string,
): string | undefined {
  return rowErrors.find((e) => e.rowIndex === rowIndex && e.field === field)?.message;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function rowFieldId(rowIndex: number, field: string): string {
  return `baris-${rowIndex + 1}-${field}`;
}

/* ── Ikon: satu set garis nipis buatan sendiri, bukan pustaka ikon ── */

function IconSearch(props: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-3.6-3.6" />
    </svg>
  );
}

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cn("transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]", open && "rotate-180")}
    >
      <path d="M6 9.5l6 6 6-6" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4.5 12.5l5 5 10-11" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 5.5v13M5.5 12h13" />
    </svg>
  );
}

function IconStrike() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4.5 7h15" />
      <path d="M10 7V4.8A1.8 1.8 0 0 1 11.8 3h.4A1.8 1.8 0 0 1 14 4.8V7" />
      <path d="M6.5 7l.8 12.1A2 2 0 0 0 9.3 21h5.4a2 2 0 0 0 2-1.9L17.5 7" />
      <path d="M10.5 10.8v6M13.5 10.8v6" />
    </svg>
  );
}

function IconStamp() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M9.5 3h5v3.1l1.9 2.4c.4.5.6 1.2.6 1.8V13H7v-2.7c0-.6.2-1.3.6-1.8l1.9-2.4V3Z" />
      <path d="M5.5 16.5h13" />
      <path d="M4 20.5h16" />
    </svg>
  );
}

function IconWarning() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="mt-0.5 shrink-0"
    >
      <path d="M12 3.6 2.9 19.4h18.2L12 3.6Z" />
      <path d="M12 9.8v4.4" />
      <path d="M12 17.3h.01" />
    </svg>
  );
}

/**
 * Segel pencatatan. Motif gelombang di dalamnya adalah batik yang sama
 * dengan `.motif-divider`, jadi halaman ini dan penandanya satu keluarga
 * visual. Warna hijau hutan + cincin emas: satu aksen, satu momen.
 */
function SealMark() {
  return (
    <span className="relative grid h-24 w-24 shrink-0 place-items-center sm:h-28 sm:w-28">
      <span
        aria-hidden="true"
        className="seal-ink absolute inset-0 rounded-full border-2 border-gold-deep/70"
      />
      <svg
        viewBox="0 0 120 120"
        aria-hidden="true"
        focusable="false"
        className="seal-press relative h-full w-full"
      >
        <circle cx="60" cy="60" r="57" className="fill-forest" />
        {/* `strokeDasharray` dan `strokeLinecap` tetap atribut SVG: Tailwind
            tidak punya utilitas untuk keduanya, sedangkan kelas warna dan
            lebar tetap berlaku karena CSS mengalahkan atribut presentasi. */}
        <circle
          cx="60"
          cy="60"
          r="51"
          strokeDasharray="1.6 6"
          strokeLinecap="round"
          className="stroke-gold-light stroke-[2]"
        />
        <circle cx="60" cy="60" r="42.5" className="stroke-gold-light stroke-[2.5]" />
        <path
          d="M0 28 C28 0 28 56 56 28 C84 0 84 56 112 28"
          transform="translate(4 32)"
          strokeLinecap="round"
          className="stroke-gold-light stroke-[3]"
        />
      </svg>
    </span>
  );
}

/**
 * Gerak halaman ini. Semua@keyframes di sini otomatis dinetralkan oleh
 * `globals.css` saat pengguna meminta gerak minimum; blok `@media` di bawah
 * menjaga agar nilai akhir tetap sama persis dengan keadaan diam.
 */
function LedgerStyles() {
  return (
    <style jsx global>{`
      /* Baris baru: masuk ke buku dengan anak tangga pendek per isian,
         supaya mata mengikuti urutan kolom tanpa satu blok ikut bergerak. */
      @keyframes ledger-row-enter {
        from {
          opacity: 0;
          transform: translateY(-8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .ledger-row-enter > * {
        animation: ledger-row-enter 300ms var(--ease-warm) both;
      }

      /* Segel: ditekan, sedikit miring, lalu diam seperti cap tangan. */
      @keyframes seal-press {
        0% {
          opacity: 0;
          transform: scale(1.5) rotate(-15deg);
        }
        55% {
          opacity: 1;
        }
        100% {
          opacity: 1;
          transform: scale(1) rotate(-6deg);
        }
      }
      .seal-press {
        transform: rotate(-6deg);
        animation: seal-press 620ms var(--ease-warm) both;
      }

      /* Tinta menyebar lalu menghilang: jejak cap yang mengering. */
      @keyframes seal-ink {
        0% {
          opacity: 0.6;
          transform: scale(0.55);
        }
        100% {
          opacity: 0;
          transform: scale(1.4);
        }
      }
      .seal-ink {
        animation: seal-ink 900ms ease-out 140ms both;
      }

      /* ── Tekstur kertas buku ──
         Kertas buku kas bergaris memakai garis-garis abu yang sangat halus.
         Garis itu ditulis dari warna wood yang transparan penuh, bukan dari
         utilitas Tailwind: proyek ini tidak mengimpor plugin tipografi, dan
         menulis ulang definisi utilitas berarti menyalin Tailwind ke dalam
         halaman. Garis berjalan di belakang isian supaya buku tetap terbaca
         sebagai kertas, bukan sebagai kartu. */
      .ledger-paper {
        background-image: repeating-linear-gradient(
          to bottom,
          rgba(111, 74, 43, 0.09) 0,
          rgba(111, 74, 43, 0.09) 1px,
          transparent 1px,
          transparent 2rem
        );
      }
      /* Jalur lipatan buku: satu garis penuh di tepi kiri, penanda buku yang
         disatukan, bukan hiasan per baris. */
      .ledger-binding {
        border-left-width: 3px;
        border-left-color: rgba(180, 135, 42, 0.35);
      }

      @media (prefers-reduced-motion: reduce) {
        .ledger-row-enter > *,
        .seal-press,
        .seal-ink {
          animation: none !important;
          opacity: 1;
          transform: none;
        }
        .seal-press {
          transform: rotate(-6deg);
        }
      }
    `}</style>
  );
}

/* ── Combobox keluarga besar ─────────────────────────────────── */

const BRANCH_INPUT_ID = "keluarga-besar";
const BRANCH_LISTBOX_ID = "keluarga-besar-daftar";
const BRANCH_HINT_ID = "keluarga-besar-catatan";

function BranchPicker({
  branches,
  value,
  onChange,
  invalid,
  error,
  inputRef,
}: {
  branches: RegistrationBranch[];
  value: string | null;
  onChange: (id: string) => void;
  invalid: boolean;
  error?: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const options = useMemo(() => filterBranches(branches, query), [branches, query]);
  const selected = branches.find((b) => b.id === value) ?? null;

  // Tutup saat klik/tap di luar. `pointerdown` dipilih (bukan blur) supaya
  // menekan pilihan tidak lebih dulu menutup daftar di perangkat sentuh.
  useEffect(() => {
    if (!open) return;
    function onOutside(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onOutside);
    return () => document.removeEventListener("pointerdown", onOutside);
  }, [open]);

  function openList() {
    setOpen(true);
    setQuery("");
    setActiveIndex(0);
  }

  function choose(branch: RegistrationBranch) {
    onChange(branch.id);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      if (options.length === 0) return;
      setActiveIndex((i) =>
        event.key === "ArrowDown"
          ? (i + 1) % options.length
          : (i - 1 + options.length) % options.length,
      );
      return;
    }
    if (event.key === "Enter") {
      if (open && options[activeIndex]) {
        event.preventDefault();
        choose(options[activeIndex]);
      }
      return;
    }
    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
      }
      return;
    }
    if (event.key === "Tab") setOpen(false);
  }

  const activeOptionId = open && options[activeIndex] ? `opsi-${options[activeIndex].id}` : undefined;
  const errorId = `${BRANCH_INPUT_ID}-galat`;

  return (
    <div ref={wrapRef} className="relative">
      <label htmlFor={BRANCH_INPUT_ID} className="block text-sm font-semibold text-forest">
        Keluarga besar
      </label>

      <div className="group relative mt-2">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        >
          <IconSearch />
        </span>
        <input
          ref={inputRef}
          id={BRANCH_INPUT_ID}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={BRANCH_LISTBOX_ID}
          aria-autocomplete="list"
          aria-activedescendant={activeOptionId}
          aria-invalid={invalid || undefined}
          aria-describedby={cn(error && errorId, !error && BRANCH_HINT_ID)}
          autoComplete="off"
          value={open ? query : (selected?.name ?? "")}
          placeholder="Ketik nama keluarga besar"
          onFocus={() => {
            if (open) return;
            setQuery("");
            setActiveIndex(0);
            setOpen(true);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className={cn(
            "min-h-11 w-full rounded-sm border bg-cream py-2 pl-10 pr-24 text-sm text-ink",
            "placeholder:text-muted/80",
            invalid ? "border-wood" : "border-wood/35 focus:border-forest/70",
          )}
        />
        <span className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {selected && (
            <button
              type="button"
              onClick={() => onChange("")}
              aria-label="Kosongkan pilihan keluarga besar"
              className="grid h-11 w-11 place-items-center rounded-sm text-muted transition-colors hover:bg-wood/10 hover:text-wood"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          )}
          <span aria-hidden="true" className="grid h-11 w-11 place-items-center text-muted">
            <IconChevron open={open} />
          </span>
        </span>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -bottom-px h-[2px] origin-left scale-x-0 rounded-full bg-gold-deep transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-focus-within:scale-x-100"
        />
      </div>

      {/* `aria-controls` harus selalu menunjuk elemen yang ada, jadi listbox
          tidak hilang saat tidak ada hasil; yang hilang hanya tampilannya,
          dan pesan "tidak cocok" berdiri sendiri di bawahnya. */}
      <ul
        id={BRANCH_LISTBOX_ID}
        role="listbox"
        aria-label="Daftar keluarga besar"
        hidden={!(open && options.length > 0)}
        className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-sm border border-wood/25 bg-cream py-1 shadow-lg shadow-wood/10"
      >
        {options.map((branch, index) => {
          const isSelected = branch.id === value;
          return (
            <li
              key={branch.id}
              id={`opsi-${branch.id}`}
              role="option"
              aria-selected={isSelected}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(branch)}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm text-ink",
                index === activeIndex ? "bg-parchment" : "bg-transparent",
              )}
            >
              <span className="w-8 shrink-0 font-display text-sm tabular-nums text-gold-deep">
                {pad2(branch.branchNumber)}
              </span>
              <span className="min-w-0 flex-1 truncate">{branch.name}</span>
              {isSelected && (
                <span className="shrink-0 text-forest">
                  <IconCheck />
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {open && options.length === 0 && (
        <div className="absolute z-30 mt-1 w-full rounded-sm border border-wood/25 bg-cream px-4 py-6 text-center shadow-lg shadow-wood/10">
          <p className="text-sm text-muted">
            Tidak ada keluarga besar yang cocok dengan “{query.trim()}”.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setActiveIndex(0);
              inputRef.current?.focus();
            }}
            className="mt-2 text-sm font-semibold text-forest underline decoration-gold-deep decoration-2 underline-offset-4"
          >
            Lihat semua keluarga besar
          </button>
        </div>
      )}

      {error ? (
        <p id={errorId} className="mt-2 flex items-start gap-1.5 text-sm font-medium text-wood">
          <IconWarning />
          {error}
        </p>
      ) : (
        <p id={BRANCH_HINT_ID} className="mt-2 text-sm text-muted">
          Ketik sebagian nama untuk mencari. Gunakan tombol panah atas dan bawah untuk menelusuri
          daftar, Enter untuk memilih, Escape untuk menutup.
        </p>
      )}
    </div>
  );
}

/* ── Satu isian baris: label, garis bawah emas saat fokus, pesan galat ── */

function RowField({
  rowIndex,
  field,
  label,
  error,
  children,
  stagger,
}: {
  rowIndex: number;
  field: string;
  label: string;
  error?: string;
  children: React.ReactNode;
  stagger?: React.CSSProperties;
}) {
  const id = rowFieldId(rowIndex, field);
  const errorId = `${id}-galat`;
  return (
    <div style={stagger}>
      <label htmlFor={id} className="block text-xs font-medium text-muted xl:sr-only">
        {label}
      </label>
      {children}
      {error && (
        <p id={errorId} className="mt-1.5 flex items-start gap-1 text-xs font-medium text-wood">
          <IconWarning />
          {error}
        </p>
      )}
    </div>
  );
}

function RuleInput({
  invalid,
  id,
  ...rest
}: {
  invalid?: boolean;
  id: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <span className="group relative mt-1 block">
      <input
        id={id}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-galat` : undefined}
        className={cn(
          "block min-h-11 w-full rounded-sm border bg-cream px-3 py-2 text-sm text-ink",
          "placeholder:text-muted/80",
          invalid ? "border-wood" : "border-wood/35 focus:border-forest/70",
        )}
        {...rest}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -bottom-px h-[2px] origin-left scale-x-0 rounded-full bg-gold-deep transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-focus-within:scale-x-100"
      />
    </span>
  );
}

function RuleSelect({
  invalid,
  id,
  children,
  ...rest
}: {
  invalid?: boolean;
  id: string;
  children: React.ReactNode;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="group relative mt-1 block">
      <select
        id={id}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-galat` : undefined}
        className={cn(
          "block min-h-11 w-full appearance-none rounded-sm border bg-cream py-2 pl-3 pr-8 text-sm text-ink",
          invalid ? "border-wood" : "border-wood/35 focus:border-forest/70",
        )}
        {...rest}
      >
        {children}
      </select>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-muted"
      >
        <IconChevron open={false} />
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -bottom-px h-[2px] origin-left scale-x-0 rounded-full bg-gold-deep transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-focus-within:scale-x-100"
      />
    </span>
  );
}

/* ── Baris buku: satu blok isian per anggota ────────────────── */

/* Kolom hanya berbaris pada layar lebar. Di bawah itu baris menjadi satu
   blok bertumpuk: lima kolom di 360px hanya memeras isian, bukan
   memudahkan pembacaan, dan keyboard ponsel menutupi baris paling bawah. */
const LEDGER_COLUMNS =
  "xl:grid-cols-[2.75rem_minmax(0,1fr)_minmax(0,1.3fr)_4.75rem_10rem_9rem_2.75rem]";

function LedgerLine({
  row,
  rowIndex,
  rowErrors,
  disabled,
  entering,
  onChange,
  onRemove,
  canRemove,
  isLast,
}: {
  row: LedgerRow;
  rowIndex: number;
  rowErrors: RowFieldError[];
  disabled: boolean;
  entering: boolean;
  onChange: (patch: Partial<LedgerRow>) => void;
  onRemove: () => void;
  canRemove: boolean;
  isLast: boolean;
}) {
  // Anak tangga entrance: tiap isian baris baru telat sedikit, jadi mata
  // mengikuti urutan kolom dan bukan satu blok yang meleset sekaligus.
  const STAGGER_MS = [0, 45, 90, 135, 180];
  const stagger = (n: number): React.CSSProperties | undefined =>
    entering ? { animationDelay: `${STAGGER_MS[n]}ms` } : undefined;
  const deceased = row.status === "DECEASED";

  return (
    <li
      className={cn(
        "grid grid-cols-1 gap-x-4 gap-y-3 py-4 xl:items-end xl:gap-y-1 xl:py-3",
        !isLast && "border-b border-wood/15",
        entering && "ledger-row-enter",
      )}
    >
      {/* Di layar kecil baris ini jadi strip nomor + tombol hapus; di layar
          lebar `xl:contents` melepaskannya jadi dua sel grid biasa. */}
      <div className="flex items-center justify-between gap-3 xl:contents">
        <span
          className="font-display text-sm font-semibold tabular-nums text-gold-deep xl:col-start-1 xl:row-start-1 xl:text-center"
          style={stagger(0)}
        >
          <span className="sr-only">Baris </span>
          {pad2(rowIndex + 1)}
        </span>
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label={`Hapus baris ${rowIndex + 1}`}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-sm text-muted transition-colors hover:bg-wood/10 hover:text-wood disabled:cursor-not-allowed disabled:opacity-40 xl:col-start-7 xl:row-start-1"
        >
          <IconStrike />
        </button>
      </div>

      <RowField
        rowIndex={rowIndex}
        field="namaPanggilan"
        label="Nama panggilan"
        stagger={stagger(0)}
        error={fieldErrorOf(rowErrors, rowIndex, "namaPanggilan")}
      >
        <RuleInput
          id={rowFieldId(rowIndex, "namaPanggilan")}
          value={row.namaPanggilan}
          onChange={(e) => onChange({ namaPanggilan: e.target.value })}
          placeholder="Mis. Pak Basri"
          maxLength={100}
          disabled={disabled}
          autoComplete="off"
          invalid={Boolean(fieldErrorOf(rowErrors, rowIndex, "namaPanggilan"))}
        />
      </RowField>

      <RowField
        rowIndex={rowIndex}
        field="namaLengkap"
        label="Nama lengkap"
        stagger={stagger(1)}
        error={fieldErrorOf(rowErrors, rowIndex, "namaLengkap")}
      >
        <RuleInput
          id={rowFieldId(rowIndex, "namaLengkap")}
          value={row.namaLengkap}
          onChange={(e) => onChange({ namaLengkap: e.target.value })}
          placeholder="Nama sesuai KTP atau akta lahir"
          maxLength={200}
          disabled={disabled}
          autoComplete="off"
          invalid={Boolean(fieldErrorOf(rowErrors, rowIndex, "namaLengkap"))}
        />
      </RowField>

      <RowField
        rowIndex={rowIndex}
        field="gender"
        label="Laki-laki (L) atau perempuan (P)"
        stagger={stagger(2)}
        error={fieldErrorOf(rowErrors, rowIndex, "gender")}
      >
        <RuleSelect
          id={rowFieldId(rowIndex, "gender")}
          value={row.gender}
          onChange={(e) => onChange({ gender: e.target.value as LedgerRow["gender"] })}
          disabled={disabled}
          invalid={Boolean(fieldErrorOf(rowErrors, rowIndex, "gender"))}
        >
          <option value="">Pilih</option>
          <option value="L">L</option>
          <option value="P">P</option>
        </RuleSelect>
      </RowField>

      <RowField
        rowIndex={rowIndex}
        field="status"
        label="Status"
        stagger={stagger(3)}
        error={fieldErrorOf(rowErrors, rowIndex, "status")}
      >
        <RuleSelect
          id={rowFieldId(rowIndex, "status")}
          value={row.status}
          onChange={(e) => {
            const status = e.target.value as LedgerRow["status"];
            // Yang wafat tidak bisa jadi peserta reuni, jadi centang hadir
            // dilepas agar angka peserta di server dan di layar ini sama.
            onChange(status === "DECEASED" ? { status, hadir: false } : { status });
          }}
          disabled={disabled}
          invalid={Boolean(fieldErrorOf(rowErrors, rowIndex, "status"))}
        >
          <option value="ALIVE">Masih hidup</option>
          <option value="DECEASED">Sudah meninggal</option>
        </RuleSelect>
      </RowField>

      <RowField
        rowIndex={rowIndex}
        field="hadir"
        label="Hadir di reuni"
        stagger={stagger(4)}
        error={fieldErrorOf(rowErrors, rowIndex, "hadir")}
      >
        <label
          htmlFor={rowFieldId(rowIndex, "hadir")}
          className="mt-1 flex min-h-11 cursor-pointer items-center gap-2.5 xl:min-h-0"
        >
          <input
            id={rowFieldId(rowIndex, "hadir")}
            type="checkbox"
            checked={row.hadir}
            disabled={disabled || deceased}
            onChange={(e) => onChange({ hadir: e.target.checked })}
            aria-describedby={deceased ? `${rowFieldId(rowIndex, "hadir")}-catatan` : undefined}
            className="h-5 w-5 shrink-0 accent-forest disabled:opacity-40"
          />
          <span className="text-sm text-ink xl:sr-only">Hadir di reuni</span>
        </label>
        {deceased && (
          <p id={`${rowFieldId(rowIndex, "hadir")}-catatan`} className="mt-1 text-xs leading-tight text-muted">
            Tidak jadi peserta reuni.
          </p>
        )}
      </RowField>
    </li>
  );
}

/* ── Konfirmasi: segel + rekapitulasi angka yang memang dikirim server ── */

type Confirmation = { rowCount: number; accountsMade: number; attendees: number };

function Recorded({ result, onReset }: { result: Confirmation; onReset: () => void }) {
  const figures: Array<{ value: number; label: string }> = [
    { value: result.rowCount, label: "Anggota dicatat" },
    { value: result.accountsMade, label: "Akun dibuat" },
    { value: result.attendees, label: "Hadir di reuni" },
  ];

  return (
    <section
      aria-labelledby="registrasi-tercatat"
      className="border border-wood/25 bg-parchment/70 px-5 py-10 sm:px-10 sm:py-14"
    >
      <div className="flex flex-col items-center gap-5 text-center">
        <SealMark />
        <h2
          id="registrasi-tercatat"
          className="font-display text-2xl font-semibold text-forest sm:text-3xl"
        >
          Data Anda sudah masuk buku besar
        </h2>
      </div>

      {/* Angka di sini persis angka yang dikembalikan server, bukan
          perkiraan: tiga angka itu yang dihitung saat pendaftaran disimpan. */}
      <dl className="mt-8 grid grid-cols-3 divide-x divide-wood/25 border-y border-wood/25 py-4">
        {figures.map((figure) => (
          <div key={figure.label} className="px-2 text-center">
            <dd className="font-display text-3xl font-semibold tabular-nums text-forest sm:text-4xl">
              {figure.value}
            </dd>
            <dt className="mt-1 text-xs leading-tight text-muted sm:text-sm">{figure.label}</dt>
          </div>
        ))}
      </dl>

      <div className="mt-8 flex flex-col items-center gap-5 text-center">
        <p className="max-w-prose text-sm leading-relaxed text-muted">
          Akun untuk setiap anggota sudah dibuat dengan kata sandi bawaan. Nama pengguna dan kata
          sandi tidak pernah ditampilkan di halaman publik ini, pengurus membagikannya lewat kanal
          keluarga. Saat pertama kali masuk, setiap anggota diminta mengganti kata sandinya sendiri.
        </p>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-forest/35 px-5 text-sm font-semibold text-forest transition-colors hover:bg-forest hover:text-cream"
        >
          Daftar lagi
        </button>
      </div>
    </section>
  );
}

export function RegistrasiForm({
  branches,
  reuniTitle,
}: {
  branches: RegistrationBranch[];
  reuniTitle: string;
}) {
  const [rows, setRows] = useState<LedgerRow[]>(() => createLedgerRows());
  const [branchId, setBranchId] = useState("");
  const [branchError, setBranchError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<RowFieldError[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Confirmation | null>(null);
  const [enteringIndex, setEnteringIndex] = useState<number | null>(null);

  const branchInputRef = useRef<HTMLInputElement | null>(null);
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (enterTimer.current) clearTimeout(enterTimer.current);
  }, []);

  const filled = submittedRows(rows).length;
  const attendees = attendeeCount(rows);
  const selectedBranch = branches.find((b) => b.id === branchId) ?? null;

  function updateRow(rowIndex: number, patch: Partial<LedgerRow>) {
    setRows((prev) => prev.map((row, i) => (i === rowIndex ? { ...row, ...patch } : row)));
  }

  function chooseBranch(id: string) {
    setBranchId(id);
    setBranchError(null);
  }

  function addRow() {
    if (rows.length >= MAX_LEDGER_ROWS) return;
    const nextIndex = rows.length;
    setRows((prev) => [...prev, createLedgerRow()]);
    setEnteringIndex(nextIndex);
    if (enterTimer.current) clearTimeout(enterTimer.current);
    enterTimer.current = setTimeout(() => setEnteringIndex(null), 700);
    requestAnimationFrame(() => focusField(nextIndex, "namaPanggilan"));
  }

  function removeRow(rowIndex: number) {
    if (rows.length <= 1) return;
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== rowIndex)));
    setRowErrors([]);
    // Fokus pindah ke baris yang mengambil alih posisi baris yang dihapus.
    const nextIndex = Math.min(rowIndex, rows.length - 2);
    requestAnimationFrame(() => focusField(nextIndex, "namaPanggilan"));
  }

  function resetForm() {
    setRows(createLedgerRows());
    setBranchId("");
    setBranchError(null);
    setRowErrors([]);
    setFormError(null);
    setResult(null);
    requestAnimationFrame(() => branchInputRef.current?.focus());
  }

  function focusField(rowIndex: number, field: string) {
    document.getElementById(rowFieldId(rowIndex, field))?.focus();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setRowErrors([]);
    setFormError(null);

    if (!branchId) {
      setBranchError("Pilih keluarga besar terlebih dahulu.");
      branchInputRef.current?.focus();
      return;
    }

    const submitted = submittedRows(rows);
    if (submitted.length === 0) {
      setFormError("Isi minimal satu baris anggota: nama panggilan dan nama lengkap.");
      focusField(0, "namaPanggilan");
      return;
    }

    const partialIndex = submitted.find(({ row }) => isRowPartial(row))?.uiIndex;
    if (partialIndex !== undefined) {
      setFormError(
        "Baris yang terisi sebagian harus nama panggilan dan nama lengkapnya dua-duanya, atau dikosongkan.",
      );
      focusField(partialIndex, "namaPanggilan");
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/registrasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId, rows: toPayloadRows(rows) }),
      });

      const data = (await response.json().catch(() => null)) as
        | (Confirmation & { ok?: boolean; error?: string; errors?: RegistrationRowError[] })
        | null;

      if (!response.ok) {
        const mapped = mapServerErrors(data?.errors, submitted);
        setRowErrors(mapped.rowErrors);
        setFormError(data?.error ?? mapped.formError ?? "Pendaftaran belum tersimpan. Coba lagi.");
        return;
      }

      setResult({
        rowCount: data?.rowCount ?? 0,
        accountsMade: data?.accountsMade ?? 0,
        attendees: data?.attendees ?? 0,
      });
    } catch {
      setFormError("Tidak sampai ke server. Periksa koneksi Anda, lalu kirim ulang halaman ini.");
    } finally {
      setPending(false);
    }
  }

  if (result) {
    return (
      <>
        <LedgerStyles />
        <Recorded
          result={result}
          onReset={resetForm}
        />
      </>
    );
  }

  const noBranches = branches.length === 0;

  if (noBranches) {
    // Tanpa daftar keluarga besar tidak ada yang bisa dikirim, jadi halaman
    // buku tidak ditampilkan sama sekali: 50 baris isian yang mustahil
    // terkirim hanya menambah kebingungan.
    return (
      <>
        <LedgerStyles />
        <EmptyState
          title="Belum ada keluarga besar yang bisa dipilih"
          description="Daftar keluarga besar belum tersedia di basis data, jadi form belum bisa dikirim. Hubungi pengurus agar cabangnya diaktifkan lebih dulu, lalu kembali ke halaman ini."
        />
      </>
    );
  }

  return (
    <>
      <LedgerStyles />
      <form onSubmit={handleSubmit} noValidate className="space-y-10">
        {/* 1. Keluarga besar */}
        <section
          aria-labelledby="bagian-keluarga"
          className="border border-wood/25 bg-parchment/50 px-5 py-6 sm:px-7"
        >
          <div className="flex items-baseline gap-3">
            <span aria-hidden="true" className="font-display text-sm font-semibold text-gold-deep">
              I
            </span>
            <h2 id="bagian-keluarga" className="font-display text-lg font-semibold text-forest">
              Pilih keluarga besar
            </h2>
          </div>

          <div className="mt-4">
            <BranchPicker
              branches={branches}
              value={branchId || null}
              onChange={chooseBranch}
              invalid={Boolean(branchError)}
              error={branchError ?? undefined}
              inputRef={branchInputRef}
            />
          </div>
        </section>

        {/* 2. Ledger anggota */}
        <section aria-labelledby="bagian-anggota">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <div className="flex items-baseline gap-3">
              <span aria-hidden="true" className="font-display text-sm font-semibold text-gold-deep">
                II
              </span>
              <h2 id="bagian-anggota" className="font-display text-lg font-semibold text-forest">
                Tulis anggota keluarga
              </h2>
            </div>
            <p className="text-sm text-muted">
              {rows.length} dari {MAX_LEDGER_ROWS} baris
            </p>
          </div>

          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
            Baris yang dibiarkan kosong diabaikan. Baris yang terisi sebagian akan ditandai untuk
            Anda perbaiki. Anggota yang sudah wafat tetap dicatat, tetapi tidak dihitung sebagai
            peserta {reuniTitle}.
          </p>

          <div className="ledger-binding ledger-paper mt-6 border-y border-wood/15 px-3 sm:px-4">
            <div
              className={cn(
                "hidden gap-x-4 border-b border-wood/30 pb-2 xl:grid",
                LEDGER_COLUMNS,
              )}
              aria-hidden="true"
            >
              <span />
              <span className="text-xs uppercase tracking-[0.12em] text-muted">Nama panggilan</span>
              <span className="text-xs uppercase tracking-[0.12em] text-muted">Nama lengkap</span>
              <span className="text-xs uppercase tracking-[0.12em] text-muted">L / P</span>
              <span className="text-xs uppercase tracking-[0.12em] text-muted">Status</span>
              <span className="text-xs uppercase tracking-[0.12em] text-muted">Hadir</span>
              <span />
            </div>

            <ul>
              {rows.map((row, index) => (
                <LedgerLine
                  key={index}
                  row={row}
                  rowIndex={index}
                  rowErrors={rowErrors}
                  disabled={pending}
                  entering={enteringIndex === index}
                  isLast={index === rows.length - 1}
                  canRemove={rows.length > 1}
                  onChange={(patch) => updateRow(index, patch)}
                  onRemove={() => removeRow(index)}
                />
              ))}
            </ul>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="button"
              onClick={addRow}
              disabled={rows.length >= MAX_LEDGER_ROWS || pending}
              className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-forest/35 px-4 text-sm font-semibold text-forest transition-colors hover:bg-forest hover:text-cream disabled:cursor-not-allowed disabled:opacity-45"
            >
              <IconPlus />
              Tambah baris
            </button>
            <p className="text-sm text-muted">
              {filled > 0
                ? `${filled} baris akan dikirim.`
                : "Belum ada baris yang terisi."}
            </p>
            {attendees > 0 && (
              <p className="text-sm text-forest">
                {attendees} orang tercatat sebagai peserta reuni.
              </p>
            )}
          </div>
        </section>

        <div className="motif-divider" aria-hidden="true" />

        {/* 3. Ringkasan galat dan tombol kirim */}
        {(formError || branchError || rowErrors.length > 0) && (
          <div
            role="alert"
            className="rounded-sm border border-wood/40 bg-wood/5 px-4 py-4 text-wood"
          >
            <p className="flex items-start gap-2 text-sm font-semibold">
              <IconWarning />
              {formError ?? branchError ?? "Ada isian yang perlu diperbaiki."}
            </p>
            {rowErrors.length > 0 && (
              <ul className="mt-2 space-y-1 pl-6">
                {rowErrors.map((err) => (
                  <li key={`${err.rowIndex}-${err.field}`}>
                    <button
                      type="button"
                      onClick={() => focusField(err.rowIndex, err.field)}
                      className="text-left text-sm underline decoration-wood/40 underline-offset-4 transition-colors hover:decoration-wood"
                    >
                      Baris {pad2(err.rowIndex + 1)}: {err.message}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-sm text-sm text-muted">
            {selectedBranch
              ? `Data akan masuk ke arsip ${selectedBranch.name}, bukan ke cabang lain.`
              : "Pilih keluarga besar di atas sebelum mengirim halaman ini."}
          </p>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-sm bg-forest px-6 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? (
              <>
                <span
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin rounded-full border-2 border-cream/40 border-t-cream"
                />
                Mengirim halaman…
              </>
            ) : (
              <>
                <IconStamp />
                Kirim ke buku besar
              </>
            )}
          </button>
        </div>
      </form>
    </>
  );
}
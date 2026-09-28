export const PARENT_SEARCH_MIN_LENGTH = 2;
export const PARENT_SEARCH_DEBOUNCE_MS = 250;
export const PARENT_SEARCH_LIMIT = 8;

/** Cukup panjang untuk dicari? Query di-trim lebih dulu. */
export function isSearchableQuery(query: string): boolean {
  return query.trim().length >= PARENT_SEARCH_MIN_LENGTH;
}

/** URL kandidat orang tua. Query kosong tidak boleh dipanggil; pakai query ter-trim. */
export function buildParentSearchUrl(branchId: string, query: string): string {
  const params =
    `branchId=${encodeURIComponent(branchId)}` +
    `&q=${encodeURIComponent(query.trim())}` +
    `&limit=${PARENT_SEARCH_LIMIT}`;
  return `/api/admin/keluarga/members?${params}`;
}

export type ParentSearchState<T> = { options: T[]; searching: boolean; error: string | null };

export type ParentSearchOptions<T> = {
  fetchMembers: (query: string, signal: AbortSignal) => Promise<T[]>;
  onChange: (state: ParentSearchState<T>) => void;
  /** Untuk test. Default: setTimeout/clearTimeout. */
  schedule?: (fn: () => void, delayMs: number) => () => void;
};

function defaultSchedule(fn: () => void, delayMs: number): () => void {
  const timer = setTimeout(fn, delayMs);
  return () => {
    clearTimeout(timer);
  };
}

function pesanGalat(galat: unknown): string {
  return galat instanceof Error ? galat.message : "Gagal mencari anggota cabang";
}

/**
 * Mesin status pencarian orang tua bebas React.
 * Semua sumber daya disuntikkan lewat opsi supaya bisa diuji dengan node:test.
 */
export function createParentSearch<T>(options: ParentSearchOptions<T>): {
  search(query: string): void;
  cancel(): void;
} {
  const schedule = options.schedule ?? defaultSchedule;

  let batalkanTimer: (() => void) | null = null;
  let controller: AbortController | null = null;
  /** Query terakhir, dipakai untuk menolak respons basi. */
  let lastQuery: string | null = null;

  function hentikanYangTertunda(): void {
    if (batalkanTimer !== null) {
      batalkanTimer();
      batalkanTimer = null;
    }
    if (controller !== null) {
      controller.abort();
      controller = null;
    }
  }

  function cancel(): void {
    hentikanYangTertunda();
  }

  function search(query: string): void {
    hentikanYangTertunda();
    const trimmed = query.trim();
    lastQuery = trimmed;

    if (!isSearchableQuery(trimmed)) {
      options.onChange({ options: [], searching: false, error: null });
      return;
    }

    // Kosongkan hasil lama segera supaya dropdown tidak menampilkan hasil query sebelumnya.
    options.onChange({ options: [], searching: true, error: null });

    batalkanTimer = schedule(() => {
      batalkanTimer = null;
      const aktif = new AbortController();
      controller = aktif;
      void options.fetchMembers(trimmed, aktif.signal).then(
        (hasil) => {
          if (lastQuery !== trimmed) return;
          options.onChange({ options: hasil, searching: false, error: null });
        },
        (galat: unknown) => {
          if (lastQuery !== trimmed) return;
          if (isAbortError(galat)) return;
          options.onChange({ options: [], searching: false, error: pesanGalat(galat) });
        },
      );
    }, PARENT_SEARCH_DEBOUNCE_MS);
  }

  return { search, cancel };
}

function isAbortError(galat: unknown): boolean {
  return galat instanceof Error && galat.name === "AbortError";
}

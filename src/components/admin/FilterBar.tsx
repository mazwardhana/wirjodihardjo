"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export type FilterConfig = {
  search?: { placeholder: string; param: string };
  filters?: Array<{
    param: string;
    label: string;
    options: Array<{ value: string; label: string }>;
  }>;
};

export function FilterBar({ config }: { config: FilterConfig }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const searchParam = config.search?.param;
  const urlValue = searchParam ? searchParams.get(searchParam) ?? "" : "";
  const location = `${pathname}?${query}`;
  const [draft, setDraft] = useState({ location, value: urlValue });
  const [isPending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reconcile URL navigation without remounting the input and losing focus.
  if (draft.location !== location) {
    setDraft({ location, value: urlValue });
  }
  const localSearch = draft.location === location ? draft.value : urlValue;

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, [location]);

  function cancelSearch() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }

  function navigate(params: URLSearchParams) {
    params.delete("page");
    const next = params.toString();
    if (next === query) return;
    startTransition(() => router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false }));
  }

  function setSearch(value: string) {
    setDraft({ location, value });
    cancelSearch();
    if (!searchParam || value.trim() === urlValue) return;
    timer.current = setTimeout(() => {
      const params = new URLSearchParams(query);
      if (value.trim()) params.set(searchParam, value.trim());
      else params.delete(searchParam);
      navigate(params);
    }, 500);
  }

  function handleFilterChange(param: string, value: string) {
    cancelSearch();
    const params = new URLSearchParams(query);
    if (searchParam) {
      if (localSearch.trim()) params.set(searchParam, localSearch.trim());
      else params.delete(searchParam);
    }
    if (value) params.set(param, value);
    else params.delete(param);
    navigate(params);
  }

  function handleReset() {
    cancelSearch();
    setDraft({ location, value: "" });
    const params = new URLSearchParams(query);
    if (searchParam) params.delete(searchParam);
    for (const filter of config.filters ?? []) params.delete(filter.param);
    navigate(params);
  }

  const hasActiveFilters = Boolean(localSearch.trim()) ||
    (config.filters ?? []).some((filter) => searchParams.has(filter.param));

  return (
    <div className="flex flex-wrap items-center gap-3" role="search" aria-busy={isPending}>
      {config.search && (
        <div className="relative w-full min-w-0 sm:w-72">
          <input
            type="search"
            value={localSearch}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={config.search.placeholder}
            aria-label={config.search.placeholder}
            className="block min-h-11 w-full rounded-md border border-wood/30 bg-cream px-4 py-2 text-sm text-forest placeholder:text-muted focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/30"
          />
        </div>
      )}
      {config.filters?.map((filter) => (
        <label key={filter.param} className="flex max-w-full items-center gap-2 text-sm text-muted">
          <span className="sr-only sm:not-sr-only">{filter.label}:</span>
          <select
            value={searchParams.get(filter.param) ?? ""}
            onChange={(event) => handleFilterChange(filter.param, event.target.value)}
            aria-label={filter.label}
            className="min-h-11 min-w-0 max-w-full rounded-md border border-wood/30 bg-cream px-3 py-2 text-sm text-forest focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/30"
          >
            <option value="">Semua</option>
            {filter.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      ))}
      {hasActiveFilters && (
        <button type="button" onClick={handleReset} className="min-h-11 px-2 text-sm text-muted underline hover:text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">
          Reset filter
        </button>
      )}
      <span role="status" className="text-sm text-muted">{isPending ? "Memuat hasil..." : ""}</span>
    </div>
  );
}

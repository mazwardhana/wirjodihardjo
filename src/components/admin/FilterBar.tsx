"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export type FilterConfig = {
  search?: {
    placeholder: string;
    param: string;
  };
  filters?: Array<{
    param: string;
    label: string;
    options: Array<{ value: string; label: string }>;
  }>;
};

export function FilterBar({ config }: { config: FilterConfig }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return <FilterControls key={`${pathname}?${searchParams}`} config={config} />;
}

function FilterControls({ config }: { config: FilterConfig }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const searchParam = config.search?.param;
  const urlValue = searchParam ? (searchParams.get(searchParam) ?? "") : "";
  const [localSearch, setLocalSearch] = useState(urlValue);

  // Sync input when the URL changes externally (back/forward, links, reset).
  useEffect(() => {
    setLocalSearch(urlValue);
  }, [urlValue]);

  // Debounced search (500ms). Skip navigation when the URL already matches
  // to avoid repeated requests and re-adding a just-reset value.
  useEffect(() => {
    if (!searchParam || localSearch.trim() === urlValue) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (localSearch.trim()) {
        params.set(searchParam, localSearch.trim());
      } else {
        params.delete(searchParam);
      }
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [localSearch, urlValue, searchParam, router, pathname, searchParams]);

  const handleFilterChange = (param: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(param, value);
    } else {
      params.delete(param);
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const activeFilters = (config.filters ?? []).filter(
    (f) => searchParams.get(f.param)
  );
  const hasActiveFilters =
    activeFilters.length > 0 || (config.search && localSearch.trim());

  // Reset clears only the params this bar owns, preserving unrelated params
  // (e.g. the status tabs on the pengajuan page).
  const handleReset = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (searchParam) params.delete(searchParam);
    for (const f of config.filters ?? []) params.delete(f.param);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3" role="search">
      {config.search && (
        <div className="relative">
          <input
            type="search"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder={config.search.placeholder}
            aria-label={config.search.placeholder}
            className="block w-full min-w-[240px] rounded-md border border-wood/30 bg-cream px-4 py-2 text-sm text-forest placeholder:text-muted/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30 sm:min-w-[280px]"
          />
          {isPending && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-forest" />
            </div>
          )}
        </div>
      )}

      {config.filters?.map((filter) => (
        <label key={filter.param} className="flex items-center gap-2 text-sm text-muted">
          <span className="sr-only sm:not-sr-only">{filter.label}:</span>
          <select
            value={searchParams.get(filter.param) ?? ""}
            onChange={(e) => handleFilterChange(filter.param, e.target.value)}
            aria-label={filter.label}
            className="rounded-md border border-wood/30 bg-cream px-3 py-2 text-sm text-forest focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
          >
            <option value="">Semua</option>
            {filter.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      ))}

      {hasActiveFilters && (
        <button
          type="button"
          onClick={handleReset}
          className="text-sm text-muted underline hover:text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          Reset filter
        </button>
      )}
    </div>
  );
}

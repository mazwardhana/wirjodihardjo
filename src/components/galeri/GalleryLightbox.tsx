"use client";

import { useEffect, useState, useCallback } from "react";

type Item = { id: string; url: string; caption: string | null };

/**
 * Masonry ringan dengan lightbox.
 * Lightbox dapat dikendalikan keyboard: panah kiri/kanan untuk navigasi,
 * Escape untuk menutup (R-32).
 */
export function GalleryLightbox({ items }: { items: Item[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);
  const next = useCallback(
    () => setOpenIndex((i) => (i === null ? null : (i + 1) % items.length)),
    [items.length],
  );
  const prev = useCallback(
    () =>
      setOpenIndex((i) =>
        i === null ? null : (i - 1 + items.length) % items.length,
      ),
    [items.length],
  );

  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIndex, close, next, prev]);

  return (
    <>
      <ul className="mt-10 columns-2 gap-4 sm:columns-3 [&>li]:mb-4">
        {items.map((item, i) => (
          <li key={item.id} className="break-inside-avoid">
            <button
              type="button"
              onClick={() => setOpenIndex(i)}
              className="group block w-full overflow-hidden rounded-lg border border-wood/15"
              aria-label={`Buka foto ${i + 1}${item.caption ? `: ${item.caption}` : ""}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt={item.caption ?? `Foto ${i + 1}`}
                loading="lazy"
                className="w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            </button>
          </li>
        ))}
      </ul>

      {openIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={items[openIndex].caption ?? `Foto ${openIndex + 1}`}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-ink/90 p-4"
          onClick={close}
        >
          <button
            type="button"
            onClick={close}
            aria-label="Tutup"
            className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-cream/10 text-cream hover:bg-cream/20"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            aria-label="Foto sebelumnya"
            className="absolute left-2 grid h-11 w-11 place-items-center rounded-full bg-cream/10 text-cream hover:bg-cream/20 sm:left-6"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>

          <figure
            className="max-h-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={items[openIndex].url}
              alt={items[openIndex].caption ?? `Foto ${openIndex + 1}`}
              className="max-h-[80vh] w-auto rounded-lg object-contain"
            />
            {items[openIndex].caption && (
              <figcaption className="mt-3 text-center text-sm text-cream/85">
                {items[openIndex].caption}
              </figcaption>
            )}
          </figure>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            aria-label="Foto berikutnya"
            className="absolute right-2 grid h-11 w-11 place-items-center rounded-full bg-cream/10 text-cream hover:bg-cream/20 sm:right-6"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}
"use client";

import { useState } from "react";
import type { TimelinePoint } from "@/lib/timeline";

// Peta dibatasi supaya halaman profil tetap ringan; sisanya cukup disebut.
const MAX_POINTS = 6;

function osmEmbedUrl(point: TimelinePoint): string {
  const bbox = [
    (point.longitude - 0.02).toFixed(4),
    (point.latitude - 0.02).toFixed(4),
    (point.longitude + 0.02).toFixed(4),
    (point.latitude + 0.02).toFixed(4),
  ].join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${point.latitude},${point.longitude}`;
}

/**
 * Daftar lokasi peristiwa dengan peta OSM yang dibuka on-demand. Iframe baru
 * dibuat saat penonton memintanya agar halaman profil tetap cepat dibuka.
 */
export function TimelineMap({ points }: { points: TimelinePoint[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const shown = points.slice(0, MAX_POINTS);
  const remaining = points.length - shown.length;

  return (
    <section className="rounded-lg border border-wood/15 bg-cream p-4 sm:p-6">
      <h2 className="font-display text-lg font-semibold text-forest">Lokasi Terkait</h2>
      <p className="mt-1 text-sm text-muted">Tempat yang menandai perjalanan hidupnya.</p>

      {points.length === 0 ? (
        <div className="mt-4 rounded-md border border-wood/20 px-6 py-10 text-center">
          <p className="text-sm text-muted">Belum ada lokasi yang tercatat di peta.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {shown.map((point) => {
            const key = `${point.latitude},${point.longitude}`;
            const isOpen = openKey === key;
            return (
              <article key={key} className="rounded-md border border-wood/20 bg-cream/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="min-w-0 font-medium text-ink">
                    {point.name}
                    {point.year !== null && <span className="ml-2 text-sm tabular-nums text-muted">{point.year}</span>}
                  </p>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenKey(isOpen ? null : key)}
                    className="min-h-11 rounded-sm border border-wood/30 px-4 py-2 text-sm font-semibold text-forest transition-colors hover:bg-wood/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                  >
                    {isOpen ? "Sembunyikan peta" : "Tampilkan peta"}
                  </button>
                </div>
                {isOpen && (
                  <iframe
                    title={`Peta ${point.name}`}
                    src={osmEmbedUrl(point)}
                    width="100%"
                    height={240}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="mt-3 rounded-md border border-wood/20"
                  />
                )}
              </article>
            );
          })}
          {remaining > 0 && <p className="text-sm text-muted">+{remaining} lokasi lain</p>}
          <p className="text-xs text-muted">
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-forest"
            >
              © OpenStreetMap contributors
            </a>
          </p>
        </div>
      )}
    </section>
  );
}

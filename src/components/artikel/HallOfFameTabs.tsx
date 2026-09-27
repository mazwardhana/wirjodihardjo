"use client";

import { useState, type ReactNode } from "react";

type TabKey = "apresiasi" | "artikel";

/**
 * Tab pada halaman Hall of Fame: Apresiasi (entri lama) dan
 * Artikel & Cerita (artikel yang sudah disetujui).
 * Konten kedua panel dikirim dari server sebagai node, sehingga data
 * tetap diambil di sisi server.
 */
export function HallOfFameTabs({
  appreciation,
  articles,
}: {
  appreciation: ReactNode;
  articles: ReactNode;
}) {
  const [active, setActive] = useState<TabKey>("apresiasi");

  const tabCls = (key: TabKey) =>
    `border-b-2 px-1 pb-3 text-sm font-semibold transition-colors ${
      active === key
        ? "border-gold text-forest"
        : "border-transparent text-muted hover:text-forest"
    }`;

  return (
    <div className="mt-8">
      <div
        role="tablist"
        aria-label="Bagian Hall of Fame"
        className="flex gap-6 border-b border-wood/20"
      >
        <button
          type="button"
          role="tab"
          id="tab-apresiasi"
          aria-selected={active === "apresiasi"}
          aria-controls="panel-apresiasi"
          onClick={() => setActive("apresiasi")}
          className={tabCls("apresiasi")}
        >
          Apresiasi
        </button>
        <button
          type="button"
          role="tab"
          id="tab-artikel"
          aria-selected={active === "artikel"}
          aria-controls="panel-artikel"
          onClick={() => setActive("artikel")}
          className={tabCls("artikel")}
        >
          Artikel &amp; Cerita
        </button>
      </div>

      <div
        role="tabpanel"
        id="panel-apresiasi"
        aria-labelledby="tab-apresiasi"
        hidden={active !== "apresiasi"}
        className="mt-8"
      >
        {appreciation}
      </div>
      <div
        role="tabpanel"
        id="panel-artikel"
        aria-labelledby="tab-artikel"
        hidden={active !== "artikel"}
        className="mt-8"
      >
        {articles}
      </div>
    </div>
  );
}

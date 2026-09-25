"use client";

import { useEffect, useRef, useState } from "react";
import { Reveal } from "@/components/ui/Reveal";

/**
 * Bercerita dengan scroll — 4 babak tentang sejarah keluarga.
 * Alasan: ENERGY 3 / MOTION 3, memberi pengunjung baru pemahaman naratif
 * tentang keluarga, bukan sekadar daftar kering.
 *
 * Setiap babak memiliki visual yang berubah: pendiri, 10 anak, pertumbuhan
 * generasi, keadaan kini. Progress bar di kiri.
 */
const BABAK = [
  {
    title: "Pasangan Pendiri",
    subtitle: "Awal dari segalanya",
    body: "Tn. & Ny. Wirjodihardjo memulai perjalanan keluarga yang kelak akan menjadi sebuah trah besar. Dari tangan dan doa mereka, lahir sepuluh anak yang menjadi cabang-cabang pertama keluarga.",
  },
  {
    title: "Sepuluh Cabang",
    subtitle: "Bermula dari satu pohon",
    body: "Sepuluh anak masing-masing membentuk garis keturunan baru. Setiap cabang tumbuh mandiri namun tetap terikat dalam satu akar yang sama — prinsip yang masih dijaga hingga keturunan sekarang.",
  },
  {
    title: "Pertumbuhan Generasi",
    subtitle: "Dari Anak hingga Trah tumerah",
    body: "Dalam budaya Jawa, setiap tingkat keturunan memiliki nama: dari Anak, Putu, Buyut, Canggah, hingga 18 tingkat ke bawah yang disebut Trah tumerah. Setiap label bukan sekadar sebutan, melainkan penanda siapa yang telah hadir dan meninggalkan jejak.",
  },
  {
    title: "Merawat Ikatan",
    subtitle: "Kini dan nanti",
    body: "Teknologi kini membantu kami merawat apa yang dulu hanya diingat. Setiap anggota tercatat, setiap kenangan tersimpan, dan setiap rencana reuni tertata — sehingga tidak ada generasi yang terlewat dari catatan keluarga.",
  },
] as const;

export function Scrollytelling() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const panels = container.querySelectorAll<HTMLElement>("[data-babak]");
    if (!panels.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number(
              (entry.target as HTMLElement).dataset.babak,
            );
            if (!isNaN(idx)) setActive(idx);
          }
        }
      },
      { threshold: 0.5, rootMargin: "-10% 0px -10% 0px" },
    );

    panels.forEach((p) => observer.observe(p));
    return () => observer.disconnect();
  }, []);

  return (
    <section aria-label="Kisah keluarga bergulir" className="relative bg-forest/5">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <Reveal as="div">
          <p className="font-display text-sm font-medium tracking-wide text-gold-deep">
            Scrollytelling
          </p>
          <h2 className="mt-2 font-display text-3xl font-semibold text-forest sm:text-4xl">
            Perjalanan trah Wirjodihardjo
          </h2>
        </Reveal>

        {/* Progress bar samping */}
        <div
          aria-hidden="true"
          className="fixed left-4 top-1/2 hidden -translate-y-1/2 lg:block"
        >
          <div className="flex flex-col gap-3">
            {BABAK.map((_, i) => (
              <span
                key={i}
                className={`block h-3 w-3 rounded-full transition-all ${
                  i === active
                    ? "scale-125 bg-gold"
                    : i < active
                      ? "bg-forest"
                      : "bg-wood/25"
                }`}
              />
            ))}
          </div>
        </div>

        <div ref={containerRef} className="mt-12 space-y-32 sm:space-y-44">
          {BABAK.map((babak, i) => (
            <article
              key={i}
              data-babak={i}
              className="grid gap-8 md:grid-cols-[1fr_1.2fr] md:items-center"
            >
              <div
                className={`order-2 rounded-xl border border-wood/20 bg-cream p-6 sm:p-8 ${
                  i % 2 === 0 ? "md:order-1" : "md:order-2"
                }`}
              >
                <span className="font-display text-sm font-semibold uppercase tracking-wider text-gold-deep">
                  Babak {i + 1}
                </span>
                <h3 className="mt-2 font-display text-2xl font-semibold text-forest">
                  {babak.title}
                </h3>
                <p className="mt-1 text-sm font-medium text-muted">
                  {babak.subtitle}
                </p>
                <p className="mt-4 leading-relaxed text-muted">{babak.body}</p>
              </div>

              {/* Visual tiap babak (ilustrasi SVG sederhana) */}
              <div
                aria-hidden="true"
                className={`order-1 flex items-center justify-center ${
                  i % 2 === 0 ? "md:order-2" : "md:order-1"
                }`}
              >
                <BabakIllustration babak={i} />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function BabakIllustration({ babak }: { babak: number }) {
  switch (babak) {
    case 0:
      return (
        <svg viewBox="0 0 180 120" className="h-40 sm:h-52" role="img" aria-label="Dua figur pendiri">
          <circle cx={72} cy={40} r={22} fill="#1f3a2b" />
          <circle cx={108} cy={40} r={22} fill="#b4872a" />
          <path d="M72 62 L72 100" stroke="#6f4a2b" strokeWidth="3" />
          <path d="M108 62 L108 100" stroke="#6f4a2b" strokeWidth="3" />
          <circle cx={90} cy={62} r={6} fill="#2c4f3b" fillOpacity="0.5" />
          <path d="M40 100 L140 100" stroke="#6f4a2b" strokeWidth="1.5" strokeDasharray="4 4" />
        </svg>
      );
    case 1:
      return (
        <svg viewBox="0 0 200 140" className="h-44 sm:h-56" role="img" aria-label="Pohon dengan sepuluh cabang">
          {Array.from({ length: 10 }).map((_, i) => {
            const x = 20 + i * 18;
            return (
              <g key={i}>
                <circle cx={x} cy={120} r={6} fill="#2c4f3b" />
                <path d={`M100 40 C${(x + 100) / 2} 80 ${(x + 100) / 2} 100 ${x} 115`} stroke="#6f4a2b" strokeWidth="1.2" fill="none" />
              </g>
            );
          })}
          <circle cx={100} cy={20} r={14} fill="#1f3a2b" />
          <circle cx={100} cy={20} r={10} fill="#b4872a" />
          <path d="M100 34 L100 130" stroke="#6f4a2b" strokeWidth="1.5" />
        </svg>
      );
    case 2:
      return (
        <svg viewBox="0 0 200 80" className="h-28 sm:h-36" role="img" aria-label="Lapis generasi">
          {[
            { y: 8, c: "#1f3a2b" },
            { y: 28, c: "#2c4f3b" },
            { y: 48, c: "#6f4a2b" },
            { y: 68, c: "#8a6238" },
          ].map((g, i) => (
            <g key={i}>
              <rect x={20 + i * 8} y={g.y} width={160 - i * 12} height={12} rx={4} fill={g.c} />
              <text
                x={100 + i * 4}
                y={g.y + 9}
                textAnchor="middle"
                fill="#f7f1e2"
                fontSize="7"
                fontFamily="serif"
              >
                {["Anak", "Putu", "Buyut", "Canggah"][i]}
              </text>
            </g>
          ))}
        </svg>
      );
    case 3:
      return (
        <svg viewBox="0 0 180 80" className="h-28 sm:h-36" role="img" aria-label="Simpul yang terhubung">
          {[40, 80, 140].map((x, i) => (
            <g key={i}>
              <circle cx={x} cy={40} r={10} fill="#2c4f3b" />
              {i < 2 && <line x1={x + 10} y1={40} x2={[60, 110][i]} y2={40} stroke="#b4872a" strokeWidth="2" strokeDasharray="4 3" />}
            </g>
          ))}
          <circle cx={180} cy={40} r={6} fill="#8a6238" fillOpacity="0.5" stroke="#b4872a" strokeWidth="1" strokeDasharray="3 3" />
        </svg>
      );
    default:
      return null;
  }
}
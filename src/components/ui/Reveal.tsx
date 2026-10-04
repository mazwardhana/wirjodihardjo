"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "li" | "article";
  style?: CSSProperties;
} & Record<string, unknown>;

/**
 * Mengungkap konten saat masuk viewport.
 * Alasan: memandu perhatian pembaca mengikuti alur cerita tanpa animasi seragam
 * di setiap elemen. Gerak dimatikan lewat CSS bila OS meminta gerak minimum.
 *
 * Properti lain (mis. `aria-labelledby`, `id`, `data-*`) diteruskan ke elemen
 * yang dirender. Tanpa itu, atribut aksesibilitas yang ditulis di pemanggil
 * hilang diam-diam: nama atribut berawalan tanda hubung lolos dari
 * pemeriksaan properti berlebih, jadi TypeScript tidak protes, sementara
 * atributnya tidak pernah sampai ke DOM.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = "div",
  style,
  ...rest
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Tidak ada cabang khusus reduced-motion di sini: globals.css sudah
    // memaksa `.reveal` terlihat (opacity 1, tanpa transform) ketika pengguna
    // meminta gerak minimum, dan durasi transisinya dititipkan ke 0.001ms.
    // Observer tetap dipasang supaya isi tetap benar saat preferensi berubah.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      {...rest}
      ref={ref as never}
      className={cn("reveal", visible && "is-visible", className)}
      style={delay ? { ...style, transitionDelay: `${delay}ms` } : style}
    >
      {children}
    </Tag>
  );
}
"use client";

import type { ReactNode } from "react";
import { Reveal } from "@/components/ui/Reveal";
import { cn } from "@/lib/utils";

/**
 * Pembungkus bagian halaman yang lembut muncul saat digulir.
 * Alasan: memberi ritme membaca pada halaman publik (MOTION 3), tanpa
 * mengulang animasi seragam per elemen.
 */
export function SectionReveal({
  children,
  className,
  as = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section";
}) {
  return (
    <Reveal as={as} className={cn(className)}>
      {children}
    </Reveal>
  );
}
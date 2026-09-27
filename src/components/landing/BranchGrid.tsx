"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type BranchGridProps = {
  children: ReactNode;
  className?: string;
};

export function BranchGrid({ children, className }: BranchGridProps) {
  const ref = useRef<HTMLUListElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -60px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <style jsx global>{`
        .branch-grid > li {
          opacity: 0;
          transform: translateY(12px);
          animation: branch-card-enter 400ms var(--ease-warm) forwards;
          animation-play-state: paused;
        }
        .branch-grid.is-visible > li {
          animation-play-state: running;
        }

        .branch-grid > li:nth-child(1) { animation-delay: 0ms; }
        .branch-grid > li:nth-child(2) { animation-delay: 60ms; }
        .branch-grid > li:nth-child(3) { animation-delay: 120ms; }
        .branch-grid > li:nth-child(4) { animation-delay: 180ms; }
        .branch-grid > li:nth-child(5) { animation-delay: 240ms; }
        .branch-grid > li:nth-child(6) { animation-delay: 300ms; }
        .branch-grid > li:nth-child(7) { animation-delay: 360ms; }
        .branch-grid > li:nth-child(8) { animation-delay: 420ms; }
        .branch-grid > li:nth-child(9) { animation-delay: 480ms; }
        .branch-grid > li:nth-child(10) { animation-delay: 540ms; }

        @keyframes branch-card-enter {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .branch-grid > li {
            animation: none;
            opacity: 1;
            transform: none;
          }
        }
      `}</style>
      <ul
        ref={ref}
        className={cn(
          "branch-grid mt-10 grid gap-6",
          "grid-cols-2",
          "md:grid-cols-3",
          "min-[1200px]:grid-cols-5",
          visible && "is-visible",
          className
        )}
      >
        {children}
      </ul>
    </>
  );
}

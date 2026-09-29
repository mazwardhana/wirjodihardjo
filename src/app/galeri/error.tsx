"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/EmptyState";

export default function GaleriError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <ErrorState
        title="Galeri gagal dimuat"
        description="Tidak dapat memuat daftar album foto. Silakan coba lagi."
        onRetry={reset}
      />
    </div>
  );
}

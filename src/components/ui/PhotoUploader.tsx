"use client";

import { useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";

interface PhotoUploaderProps {
  currentPhotoUrl: string | null | undefined;
  personName: string;
  onPhotoChange: (url: string | null) => void;
}

/**
 * Unggah foto profil dengan pratinjau, validasi ukuran/tipe, dan
 * umpan balik visual.
 */
export function PhotoUploader({
  currentPhotoUrl,
  personName,
  onPhotoChange,
}: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = async (file: File | null) => {
    setError(null);
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("Ukuran maksimal 5MB.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Format harus JPG, PNG, atau WebP.");
      return;
    }

    // Pratinjau lokal (sementara)
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setUploading(true);

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Gagal mengunggah");
      }

      const data = await res.json();
      onPhotoChange(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengunggah");
      setPreview(null);
    } finally {
      setUploading(false);
      URL.revokeObjectURL(objectUrl);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files[0] ?? null);
  };

  const handleRemove = async () => {
    if (!confirm("Hapus foto profil?")) return;
    try {
      const res = await fetch("/api/upload", { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal menghapus");
      onPhotoChange(null);
      setPreview(null);
    } catch {
      setError("Gagal menghapus foto.");
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
      <label
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={`group relative cursor-pointer overflow-hidden rounded-full ring-2 ring-gold/30 transition-all hover:ring-gold/60 ${
          uploading ? "opacity-60" : ""
        }`}
      >
        <Avatar
          name={personName}
          photoUrl={preview ?? currentPhotoUrl}
          size="xl"
        />
        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-ink/40 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="text-xs font-medium text-cream">
            {uploading ? "Mengunggah..." : "Ganti"}
          </span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          aria-label="Pilih foto profil"
        />
      </label>

      <div className="text-center sm:text-left">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-md bg-forest px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft disabled:opacity-50"
          disabled={uploading}
        >
          {uploading ? "Mengunggah..." : "Pilih Foto"}
        </button>
        {(currentPhotoUrl || preview) && (
          <button
            type="button"
            onClick={handleRemove}
            className="ml-2 rounded-md border border-wood/30 px-4 py-2 text-sm text-muted transition-colors hover:bg-wood/10"
          >
            Hapus
          </button>
        )}
        {error && (
          <p className="mt-2 text-sm font-medium text-wood" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
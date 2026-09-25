"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PhotoUploader } from "@/components/ui/PhotoUploader";

interface AlbumFormProps {
  initial?: {
    id?: string;
    title: string;
    slug: string;
    description: string;
    eventDate: string;
    coverImageUrl: string | null;
  };
}

export function AlbumForm({ initial }: AlbumFormProps) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [eventDate, setEventDate] = useState(initial?.eventDate ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(initial?.coverImageUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || undefined,
        eventDate: eventDate || undefined,
        coverImageUrl: coverImageUrl ?? undefined,
      };

      if (isEdit) {
        payload.id = initial!.id;
        const res = await fetch("/api/admin/galeri", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Gagal menyimpan album");
        router.push("/admin/galeri");
        router.refresh();
      } else {
        const res = await fetch("/api/admin/galeri", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Gagal membuat album");
        router.push("/admin/galeri");
        router.refresh();
      }
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  const inputCls =
    "mt-1 block w-full rounded-md border border-wood/30 bg-cream px-4 py-2.5 text-sm text-forest placeholder:text-muted/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30";
  const labelCls = "block text-sm font-medium text-forest";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="cover" className={labelCls}>Sampul Album</label>
        <div className="mt-2">
          <PhotoUploader
            currentPhotoUrl={coverImageUrl}
            personName={title || "Album"}
            onPhotoChange={setCoverImageUrl}
          />
        </div>
      </div>

      <div>
        <label htmlFor="title" className={labelCls}>Judul Album</label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputCls}
          required
          placeholder="Mis: Lebaran 2026"
        />
      </div>

      <div>
        <label htmlFor="eventDate" className={labelCls}>Tanggal Acara</label>
        <input
          id="eventDate"
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="desc" className={labelCls}>Deskripsi</label>
        <textarea
          id="desc"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={inputCls}
          placeholder="Cerita singkat tentang album ini…"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-wood/10 p-3 text-sm text-wood">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-gold px-5 py-2.5 text-sm font-semibold text-forest transition-colors hover:bg-gold-deep disabled:opacity-50"
        >
          {saving ? "Menyimpan…" : isEdit ? "Simpan Perubahan" : "Buat Album"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-wood/30 px-5 py-2.5 text-sm text-muted transition-colors hover:bg-wood/10"
        >
          Batal
        </button>
      </div>
    </form>
  );
}
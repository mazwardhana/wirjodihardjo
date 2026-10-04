"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toast";

export type ReunionFormValues = {
  id?: string;
  title: string;
  slug: string;
  description: string;
  startAt: string;
  endAt: string;
  locationName: string;
  locationUrl: string;
  capacity: string;
  registrationDeadline: string;
  heroImageUrl: string | null;
  status?: string;
};

const empty: ReunionFormValues = {
  title: "",
  slug: "",
  description: "",
  startAt: "",
  endAt: "",
  locationName: "",
  locationUrl: "",
  capacity: "",
  registrationDeadline: "",
  heroImageUrl: null,
};

export function ReunionForm({
  initial,
  isEdit = false,
  onSuccess,
  onCancel,
}: {
  initial?: Partial<ReunionFormValues>;
  isEdit?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<ReunionFormValues>({ ...empty, ...initial });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingHero, setUploadingHero] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof ReunionFormValues>(key: K, value: ReunionFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const handleHeroUpload = useCallback(async (file: File | null) => {
    if (!file) return;
    setUploadingHero(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/media", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal mengunggah gambar");
      set("heroImageUrl", data.url);
      toast("success", "Gambar hero diunggah");
    } catch (err) {
      toast("error", (err as Error).message);
    } finally {
      setUploadingHero(false);
    }
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const endpoint = "/api/admin/reuni";
      const method = isEdit ? "PUT" : "POST";

      const body: Record<string, unknown> = {
        title: form.title,
        slug: form.slug || undefined,
        description: form.description || undefined,
        startAt: form.startAt || undefined,
        endAt: form.endAt || undefined,
        locationName: form.locationName || undefined,
        locationUrl: form.locationUrl || undefined,
        capacity: form.capacity ? parseInt(form.capacity) : undefined,
        registrationDeadline: form.registrationDeadline || undefined,
        heroImageUrl: form.heroImageUrl ?? undefined,
      };

      if (isEdit && form.id) {
        body.id = form.id;
      }

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal menyimpan");

      toast("success", isEdit ? "Reuni berhasil diperbarui" : "Reuni berhasil dibuat");
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/admin/reuni");
        router.refresh();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [form, isEdit, onSuccess, router]);

  const inputCls =
    "mt-1 block w-full rounded-md border border-wood/30 bg-cream px-4 py-2.5 text-sm text-forest placeholder:text-muted/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30";
  const labelCls = "block text-sm font-medium text-forest";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Hero image */}
      <div>
        <label className={labelCls}>Gambar Hero</label>
        {form.heroImageUrl && (
          <div className="relative mb-2 mt-1 h-40 w-full overflow-hidden rounded-lg border border-wood/15 bg-parchment">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={form.heroImageUrl}
              alt="Hero reuni"
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={() => set("heroImageUrl", null)}
              className="absolute right-2 top-2 min-h-11 rounded-md bg-ink/50 px-2 py-1 text-xs text-cream hover:bg-ink/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
            >
              Hapus
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingHero}
          className="min-h-11 rounded-md border border-wood/30 px-4 py-2 text-sm text-muted transition-colors hover:bg-wood/10 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          {uploadingHero ? "Mengunggah..." : form.heroImageUrl ? "Ganti Gambar" : "Pilih Gambar"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => handleHeroUpload(e.target.files?.[0] ?? null)}
          aria-label="Pilih gambar hero"
        />
      </div>

      <div>
        <label htmlFor="title" className={labelCls}>Judul Reuni</label>
        <input
          id="title"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          className={inputCls}
          required
          placeholder="Contoh: Reuni Akbar Keluarga 2026"
        />
      </div>

      <div>
        <label htmlFor="slug" className={labelCls}>
          Slug (opsional, otomatis dari judul bila kosong)
        </label>
        <input
          id="slug"
          value={form.slug}
          onChange={(e) => set("slug", e.target.value)}
          className={inputCls}
          placeholder="reuni-akbar-2026"
        />
      </div>

      <div>
        <label htmlFor="description" className={labelCls}>Deskripsi</label>
        <textarea
          id="description"
          rows={4}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          className={inputCls}
          placeholder="Informasi tentang acara reuni..."
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="startAt" className={labelCls}>Tanggal Mulai (opsional)</label>
          <input
            id="startAt"
            type="datetime-local"
            value={form.startAt}
            onChange={(e) => set("startAt", e.target.value)}
            className={inputCls}
          />
          <p className="mt-1 text-xs text-muted">Kosongkan bila jadwal belum ditetapkan.</p>
        </div>
        <div>
          <label htmlFor="endAt" className={labelCls}>Tanggal Selesai (opsional)</label>
          <input
            id="endAt"
            type="datetime-local"
            value={form.endAt}
            onChange={(e) => set("endAt", e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="locationName" className={labelCls}>Nama Lokasi</label>
          <input
            id="locationName"
            value={form.locationName}
            onChange={(e) => set("locationName", e.target.value)}
            className={inputCls}
            placeholder="Gedung Serbaguna, Hotel, dll."
          />
        </div>
        <div>
          <label htmlFor="locationUrl" className={labelCls}>URL Lokasi (Google Maps, dll.)</label>
          <input
            id="locationUrl"
            value={form.locationUrl}
            onChange={(e) => set("locationUrl", e.target.value)}
            className={inputCls}
            placeholder="https://maps.google.com/..."
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="capacity" className={labelCls}>Kapasitas Peserta (opsional)</label>
          <input
            id="capacity"
            type="number"
            min="0"
            value={form.capacity}
            onChange={(e) => set("capacity", e.target.value)}
            className={inputCls}
            placeholder="100"
          />
        </div>
        <div>
          <label htmlFor="registrationDeadline" className={labelCls}>Batas Pendaftaran (opsional)</label>
          <input
            id="registrationDeadline"
            type="datetime-local"
            value={form.registrationDeadline}
            onChange={(e) => set("registrationDeadline", e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-wood/10 p-3 text-sm text-wood">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="min-h-11 rounded-md bg-gold px-5 py-2.5 text-sm font-semibold text-forest transition-colors hover:bg-gold-deep disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          {saving ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Buat Reuni"}
        </button>
        <button
          type="button"
          onClick={() => (onCancel ? onCancel() : router.back())}
          className="min-h-11 rounded-md border border-wood/30 px-5 py-2.5 text-sm text-muted transition-colors hover:bg-wood/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          Batal
        </button>
      </div>
    </form>
  );
}
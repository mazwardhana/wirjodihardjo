"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toast";
import { ArticleEditor } from "@/components/artikel/ArticleEditor";
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/upload";
import { isValidYouTubeUrl } from "@/lib/article/youtube";

type CategoryOption = { id: string; name: string };

const inputCls =
  "mt-1 block w-full rounded-md border border-wood/30 bg-cream px-4 py-2.5 text-sm text-forest placeholder:text-muted/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30";
const labelCls = "block text-sm font-medium text-forest";

export function ArticleForm({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [bodyContent, setBodyContent] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadPhoto(file: File | null) {
    if (!file) return;
    setError(null);
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("Ukuran foto maksimal 5MB.");
      return;
    }
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setError("Format foto harus JPG, PNG, atau WebP.");
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/media", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Gagal mengunggah foto");
      setPhotoUrl((data as { url: string }).url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengunggah foto");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Judul artikel wajib diisi.");
      return;
    }
    if (!categoryId) {
      setError("Pilih kategori artikel.");
      return;
    }
    const plain = bodyContent.replace(/<[^>]*>/g, "").trim();
    if (!plain) {
      setError("Isi artikel tidak boleh kosong.");
      return;
    }
    if (youtubeUrl.trim() && !isValidYouTubeUrl(youtubeUrl)) {
      setError("URL YouTube tidak valid. Gunakan format youtube.com/watch?v= atau youtu.be/.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/artikel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          bodyContent,
          excerpt: excerpt.trim() || null,
          categoryId,
          youtubeUrl: youtubeUrl.trim() || null,
          photoUrl,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Gagal mengirim artikel");

      toast("success", "Artikel dikirim dan menunggu review admin.");
      router.push("/dashboard/artikel");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengirim artikel");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
      <div>
        <label htmlFor="title" className={labelCls}>Judul</label>
        <input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={150}
          className={inputCls}
          placeholder="Contoh: Kenangan bersama Mbah Kakung"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className={labelCls}>Kategori</label>
          <select
            id="category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
            className={inputCls}
          >
            {categories.length === 0 && <option value="">Belum ada kategori</option>}
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="youtube" className={labelCls}>URL YouTube (opsional)</label>
          <input
            id="youtube"
            type="url"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            className={inputCls}
            placeholder="https://youtu.be/..."
          />
          <p className="mt-1 text-xs text-muted">
            Format yang didukung: youtube.com/watch?v= atau youtu.be/
          </p>
        </div>
      </div>

      <div>
        <label htmlFor="excerpt" className={labelCls}>Ringkasan (opsional)</label>
        <textarea
          id="excerpt"
          rows={2}
          maxLength={280}
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          className={inputCls}
          placeholder="Satu atau dua kalimat yang menggambarkan isi artikel."
        />
      </div>

      <div>
        <span className={labelCls}>Foto Utama (opsional)</span>
        <div className="mt-1 flex items-center gap-4">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt={`Pratinjau foto untuk ${title || "artikel"}`}
              className="h-28 w-40 rounded-md border border-wood/20 object-cover"
            />
          ) : (
            <div className="grid h-28 w-40 place-items-center rounded-md border border-dashed border-wood/30 bg-parchment/40 text-xs text-muted">
              Belum ada
            </div>
          )}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="block rounded-md bg-forest px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft disabled:opacity-50"
            >
              {uploading ? "Mengunggah..." : "Unggah Foto"}
            </button>
            {photoUrl && (
              <button
                type="button"
                onClick={() => setPhotoUrl(null)}
                className="block rounded-md border border-wood/30 px-4 py-2 text-sm text-muted transition-colors hover:bg-wood/10"
              >
                Hapus Foto
              </button>
            )}
            <p className="text-xs text-muted">JPG, PNG, atau WebP. Maksimal 5MB.</p>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          className="sr-only"
          onChange={(e) => uploadPhoto(e.target.files?.[0] ?? null)}
        />
      </div>

      <div>
        <span className={labelCls}>Isi Artikel</span>
        <div className="mt-1">
          <ArticleEditor content={bodyContent} onChange={setBodyContent} />
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-wood/10 p-3 text-sm text-wood">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving || categories.length === 0}
          className="rounded-md bg-gold px-5 py-2.5 text-sm font-semibold text-forest transition-colors hover:bg-gold-deep disabled:opacity-50"
        >
          {saving ? "Mengirim..." : "Kirim untuk Review"}
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

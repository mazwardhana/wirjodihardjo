"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toast";
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/upload";

type BranchFormProps = {
  initial?: {
    id?: string;
    name: string;
    description: string;
    coverImageUrl: string | null;
    orderIndex: number;
    isActive?: boolean;
  };
  mode: "create" | "edit";
};

const inputCls =
  "mt-1 block w-full rounded-md border border-wood/30 bg-cream px-4 py-2.5 text-sm text-forest placeholder:text-muted/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30";
const labelCls = "block text-sm font-medium text-forest";

export function CabangForm({ initial, mode }: BranchFormProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(initial?.coverImageUrl ?? null);
  const [orderIndex, setOrderIndex] = useState(initial?.orderIndex ?? 0);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadCover(file: File | null) {
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
      setCoverImageUrl((data as { url: string }).url);
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

    if (!name.trim()) {
      setError("Nama cabang wajib diisi.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/cabang", {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(initial?.id && { id: initial.id }),
          name: name.trim(),
          description: description.trim() || null,
          coverImageUrl: coverImageUrl || null,
          orderIndex,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Gagal menyimpan cabang");

      toast("success", mode === "create" ? "Cabang berhasil dibuat." : "Cabang berhasil diperbarui.");
      router.push("/admin/cabang");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan cabang");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <div>
        <label htmlFor="name" className={labelCls}>Nama Cabang</label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className={inputCls}
          placeholder="Contoh: Cabang Jakarta"
        />
      </div>

      <div>
        <label htmlFor="description" className={labelCls}>Deskripsi</label>
        <textarea
          id="description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={inputCls}
          placeholder="Cerita singkat tentang cabang ini (opsional)"
        />
      </div>

      <div>
        <span className={labelCls}>Foto Sampul</span>
        <div className="mt-1 flex items-center gap-4">
          {coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverImageUrl}
              alt="Pratinjau sampul cabang"
              className="h-32 w-48 rounded-md border border-wood/20 object-cover"
            />
          ) : (
            <div className="grid h-32 w-48 place-items-center rounded-md border border-dashed border-wood/30 bg-parchment/40 text-xs text-muted">
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
              {uploading ? "Mengunggah..." : coverImageUrl ? "Ganti Sampul" : "Unggah Sampul"}
            </button>
            {coverImageUrl && (
              <button
                type="button"
                onClick={() => setCoverImageUrl(null)}
                className="block rounded-md border border-wood/30 px-4 py-2 text-sm text-muted transition-colors hover:bg-wood/10"
              >
                Hapus
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
          onChange={(e) => uploadCover(e.target.files?.[0] ?? null)}
        />
      </div>

      <div>
        <label htmlFor="orderIndex" className={labelCls}>Urutan</label>
        <input
          id="orderIndex"
          type="number"
          min="0"
          value={orderIndex}
          onChange={(e) => setOrderIndex(parseInt(e.target.value) || 0)}
          className={`${inputCls} w-32`}
        />
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
          className="rounded-md bg-gold px-5 py-2.5 text-sm font-semibold text-forest transition-colors hover:bg-gold-deep disabled:opacity-50"
        >
          {saving ? "Menyimpan..." : mode === "create" ? "Buat Cabang" : "Simpan Perubahan"}
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
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
  onSuccess?: () => void;
  onCancel?: () => void;
};

const inputCls =
  "mt-1 block w-full rounded-md border border-wood/30 bg-cream px-4 py-2.5 text-sm text-forest placeholder:text-muted/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30";
const labelCls = "block text-sm font-medium text-forest";

export function CabangForm({ initial, mode, onSuccess, onCancel }: BranchFormProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(initial?.coverImageUrl ?? null);
  const [orderIndex, setOrderIndex] = useState(initial?.orderIndex ?? 0);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rootMode, setRootMode] = useState<"new" | "existing">("new");
  const [rootName, setRootName] = useState("");
  const [rootGender, setRootGender] = useState<"MALE" | "FEMALE" | "OTHER">("MALE");
  const [rootBirthDate, setRootBirthDate] = useState("");
  const [rootQuery, setRootQuery] = useState("");
  const [rootResults, setRootResults] = useState<{ id: string; fullName: string }[]>([]);
  const [rootSelected, setRootSelected] = useState<{ id: string; fullName: string } | null>(null);
  const [rootSearching, setRootSearching] = useState(false);

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

  async function searchRootCandidates() {
    const q = rootQuery.trim();
    if (q.length < 2) {
      setError("Ketik minimal 2 karakter untuk mencari anggota.");
      return;
    }
    setRootSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/cari-orang?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error("Gagal mencari anggota");
      const data = (await res.json()) as { id: string; fullName: string }[];
      setRootResults(data);
      if (data.length === 0) setError("Anggota tidak ditemukan.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mencari anggota");
    } finally {
      setRootSearching(false);
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
          ...(mode === "create" && rootMode === "new" && rootName.trim()
            ? {
                rootPerson: {
                  fullName: rootName.trim(),
                  gender: rootGender,
                  birthDate: rootBirthDate || undefined,
                },
              }
            : {}),
          ...(mode === "create" && rootMode === "existing" && rootSelected
            ? { rootPersonId: rootSelected.id }
            : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Gagal menyimpan cabang");

      toast("success", mode === "create" ? "Cabang berhasil dibuat." : "Cabang berhasil diperbarui.");
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/admin/cabang");
        router.refresh();
      }
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

      {mode === "create" && (
        <fieldset className="space-y-3">
          <legend className={labelCls}>Akar cabang (generasi 1)</legend>
          <p className="text-xs text-muted">
            Kosongkan bila belum tahu. Anggota inilah yang memulai garis keturunan cabang ini.
          </p>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-forest">
              <input
                type="radio"
                name="rootMode"
                value="new"
                checked={rootMode === "new"}
                onChange={() => {
                  setRootMode("new");
                  setRootSelected(null);
                }}
                className="h-4 w-4 accent-forest"
              />
              Buat anggota baru
            </label>
            <label className="flex items-center gap-2 text-sm text-forest">
              <input
                type="radio"
                name="rootMode"
                value="existing"
                checked={rootMode === "existing"}
                onChange={() => {
                  setRootMode("existing");
                  setRootName("");
                }}
                className="h-4 w-4 accent-forest"
              />
              Pilih anggota yang sudah ada
            </label>
          </div>

          {rootMode === "new" ? (
            <div className="space-y-3 rounded-md border border-wood/20 p-3">
              <div>
                <label htmlFor="rootName" className={labelCls}>Nama Lengkap</label>
                <input
                  id="rootName"
                  value={rootName}
                  onChange={(event) => setRootName(event.target.value)}
                  className={inputCls}
                  placeholder="Nama anggota akar"
                />
              </div>
              <div>
                <label htmlFor="rootGender" className={labelCls}>Jenis Kelamin</label>
                <select
                  id="rootGender"
                  value={rootGender}
                  onChange={(event) => setRootGender(event.target.value as typeof rootGender)}
                  className={inputCls}
                >
                  <option value="MALE">Laki-laki</option>
                  <option value="FEMALE">Perempuan</option>
                  <option value="OTHER">Lainnya</option>
                </select>
              </div>
              <div>
                <label htmlFor="rootBirthDate" className={labelCls}>Tanggal Lahir</label>
                <input
                  id="rootBirthDate"
                  type="date"
                  value={rootBirthDate}
                  onChange={(event) => setRootBirthDate(event.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-md border border-wood/20 p-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-52 flex-1">
                  <label htmlFor="rootQuery" className={labelCls}>Cari anggota</label>
                  <input
                    id="rootQuery"
                    value={rootQuery}
                    onChange={(event) => setRootQuery(event.target.value)}
                    className={inputCls}
                    placeholder="Ketik minimal 2 karakter"
                  />
                </div>
                <button
                  type="button"
                  onClick={searchRootCandidates}
                  disabled={rootSearching}
                  className="min-h-11 rounded-md border border-wood/30 px-4 py-2 text-sm font-semibold text-forest transition-colors hover:bg-wood/10 disabled:opacity-50"
                >
                  {rootSearching ? "Mencari..." : "Cari"}
                </button>
              </div>

              {rootResults.length > 0 && (
                <ul className="space-y-1">
                  {rootResults.map((candidate) => (
                    <li key={candidate.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setRootSelected(candidate);
                          setRootResults([]);
                          setRootQuery("");
                          setError(null);
                        }}
                        className="min-h-11 w-full rounded-md border border-wood/20 px-3 py-2 text-left text-sm text-forest transition-colors hover:bg-cream"
                      >
                        {candidate.fullName}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {rootSelected && (
                <div className="flex items-center justify-between gap-3 rounded-md bg-gold/10 px-3 py-2">
                  <p className="text-sm text-forest">
                    Akar terpilih:{" "}
                    <span className="font-semibold">{rootSelected.fullName}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setRootSelected(null)}
                    className="min-h-11 px-2 text-sm text-muted underline hover:text-forest"
                  >
                    Ganti
                  </button>
                </div>
              )}
            </div>
          )}
        </fieldset>
      )}

      {error && (
        <p role="alert" className="rounded-md bg-wood/10 p-3 text-sm text-wood">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="min-h-11 rounded-md bg-gold px-5 py-2.5 text-sm font-semibold text-forest transition-colors hover:bg-gold-deep disabled:opacity-50"
        >
          {saving ? "Menyimpan..." : mode === "create" ? "Buat Cabang" : "Simpan Perubahan"}
        </button>
        <button
          type="button"
          onClick={() => (onCancel ? onCancel() : router.push("/admin/cabang"))}
          className="min-h-11 rounded-md border border-wood/30 px-5 py-2.5 text-sm text-muted transition-colors hover:bg-wood/10"
        >
          Batal
        </button>
      </div>
    </form>
  );
}
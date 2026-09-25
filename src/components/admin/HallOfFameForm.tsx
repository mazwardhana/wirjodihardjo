"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toast";
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/upload";

type EntryType = "ACHIEVEMENT" | "IN_MEMORIAM";

type PersonOption = { id: string; fullName: string };

type HallOfFameFormProps = {
  entryId?: string;
  initial?: {
    category: string;
    title: string;
    description: string;
    year: number | null;
    entryType: EntryType;
    isPublished: boolean;
    photoUrl: string | null;
  };
  initialPerson?: PersonOption | null;
};

const inputCls =
  "mt-1 block w-full rounded-md border border-wood/30 bg-cream px-4 py-2.5 text-sm text-forest placeholder:text-muted/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30";
const labelCls = "block text-sm font-medium text-forest";

export function HallOfFameForm({ entryId, initial, initialPerson }: HallOfFameFormProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState(initial?.category ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [year, setYear] = useState(initial?.year ? String(initial.year) : "");
  const [entryType, setEntryType] = useState<EntryType>(initial?.entryType ?? "ACHIEVEMENT");
  const [isPublished, setIsPublished] = useState(initial?.isPublished ?? false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(initial?.photoUrl ?? null);

  const [person, setPerson] = useState<PersonOption | null>(initialPerson ?? null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PersonOption[]>([]);
  const [searching, setSearching] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function searchPersons() {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/admin/cari-orang?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(Array.isArray(data) ? (data as PersonOption[]) : []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

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

    if (!person) {
      setError("Pilih anggota keluarga terlebih dahulu.");
      return;
    }
    if (!title.trim() || !category.trim()) {
      setError("Judul dan kategori wajib diisi.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/hall-of-fame", {
        method: entryId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(entryId && { id: entryId }),
          category: category.trim(),
          title: title.trim(),
          description: description.trim(),
          year: year.trim() || null,
          entryType,
          personId: person.id,
          photoUrl,
          ...(entryId && { isPublished }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Gagal menyimpan entri");

      toast("success", entryId ? "Entri diperbarui." : "Entri dibuat.");
      router.push("/admin/hall-of-fame");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan entri");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <div>
        <span className={labelCls}>Anggota Keluarga</span>
        {person ? (
          <div className="mt-1 flex items-center justify-between gap-3 rounded-md border border-wood/30 bg-parchment/40 px-4 py-2.5">
            <span className="text-sm font-medium text-forest">{person.fullName}</span>
            <button
              type="button"
              onClick={() => {
                setPerson(null);
                setQuery("");
                setResults([]);
              }}
              className="text-xs text-muted underline hover:text-wood"
            >
              Ganti
            </button>
          </div>
        ) : (
          <div>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onBlur={searchPersons}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  searchPersons();
                }
              }}
              placeholder="Ketik minimal 2 huruf..."
              aria-label="Cari anggota keluarga"
              className={inputCls}
            />
            {searching && <p className="mt-1 text-xs text-muted">Mencari...</p>}
            {!searching && query.trim().length >= 2 && results.length === 0 && (
              <p className="mt-1 text-xs text-muted">Tidak ada anggota yang cocok.</p>
            )}
            {results.length > 0 && (
              <ul className="mt-1 max-h-56 overflow-y-auto rounded-md border border-wood/25 bg-cream">
                {results.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setPerson(p);
                        setResults([]);
                        setQuery("");
                      }}
                      className="block w-full px-4 py-2.5 text-left text-sm text-forest transition-colors hover:bg-wood/10"
                    >
                      {p.fullName}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div>
        <span className={labelCls}>Foto Entri</span>
        <div className="mt-1 flex items-center gap-4">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt={`Pratinjau foto untuk ${title || "entri"}`}
              className="h-28 w-28 rounded-md border border-wood/20 object-cover"
            />
          ) : (
            <div className="grid h-28 w-28 place-items-center rounded-md border border-dashed border-wood/30 bg-parchment/40 text-xs text-muted">
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
        <label htmlFor="title" className={labelCls}>Judul</label>
        <input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className={inputCls}
          placeholder="Contoh: Lulusan terbaik teknik sipil"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className={labelCls}>Kategori</label>
          <input
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            className={inputCls}
            placeholder="Contoh: Pendidikan"
          />
        </div>
        <div>
          <label htmlFor="year" className={labelCls}>Tahun</label>
          <input
            id="year"
            type="number"
            min="1900"
            max="2100"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className={inputCls}
            placeholder="Opsional"
          />
        </div>
      </div>

      <div>
        <label htmlFor="entryType" className={labelCls}>Jenis Entri</label>
        <select
          id="entryType"
          value={entryType}
          onChange={(e) => setEntryType(e.target.value as EntryType)}
          className={inputCls}
        >
          <option value="ACHIEVEMENT">Prestasi</option>
          <option value="IN_MEMORIAM">In Memoriam</option>
        </select>
      </div>

      <div>
        <label htmlFor="description" className={labelCls}>Deskripsi</label>
        <textarea
          id="description"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          className={inputCls}
          placeholder="Ceritakan capaian atau kenangan yang ingin diabadikan."
        />
      </div>

      {entryId && (
        <label className="flex items-center gap-3 rounded-md border border-wood/20 bg-parchment/40 p-4">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
            className="h-4 w-4 accent-forest"
          />
          <span className="text-sm text-muted">
            Tampilkan entri ini di halaman Hall of Fame
          </span>
        </label>
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
          className="rounded-md bg-gold px-5 py-2.5 text-sm font-semibold text-forest transition-colors hover:bg-gold-deep disabled:opacity-50"
        >
          {saving ? "Menyimpan..." : entryId ? "Simpan Perubahan" : "Simpan Entri"}
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
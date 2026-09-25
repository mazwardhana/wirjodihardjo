"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toast";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/upload";

const MAX_BYTES = 5 * 1024 * 1024;

type Item = {
  key: string;
  file: File;
  preview: string;
  error: string | null;
  done: boolean;
};

/**
 * Unggah beberapa media ke album. Setiap berkas dikirim ke /api/admin/media
 * dan masuk sebagai PENDING untuk dimoderasi.
 */
export function MediaUploader({ albumId }: { albumId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const next: Item[] = [];
    for (const file of Array.from(files)) {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        next.push({
          key: crypto.randomUUID(),
          file,
          preview: "",
          error: "Format harus JPG, PNG, atau WebP",
          done: false,
        });
        continue;
      }
      if (file.size > MAX_BYTES) {
        next.push({
          key: crypto.randomUUID(),
          file,
          preview: "",
          error: "Ukuran maksimal 5MB",
          done: false,
        });
        continue;
      }
      next.push({
        key: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        error: null,
        done: false,
      });
    }
    setItems((prev) => [...prev, ...next]);
  }

  function removeItem(key: string) {
    setItems((prev) => {
      const target = prev.find((i) => i.key === key);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter((i) => i.key !== key);
    });
  }

  async function uploadAll() {
    const queue = items.filter((i) => !i.error && !i.done);
    if (queue.length === 0) {
      toast("info", "Pilih berkas terlebih dahulu.");
      return;
    }

    setUploading(true);
    let ok = 0;
    let failed = 0;

    for (const item of queue) {
      const fd = new FormData();
      fd.append("albumId", albumId);
      fd.append("file", item.file);
      if (caption.trim()) fd.append("caption", caption.trim());

      try {
        const res = await fetch("/api/admin/media", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Gagal mengunggah");
        ok += 1;
        setItems((prev) =>
          prev.map((i) => (i.key === item.key ? { ...i, done: true } : i)),
        );
      } catch (e) {
        failed += 1;
        setItems((prev) =>
          prev.map((i) =>
            i.key === item.key ? { ...i, error: (e as Error).message } : i,
          ),
        );
      }
    }

    setUploading(false);

    if (ok > 0) {
      toast("success", `${ok} media diunggah dan menunggu moderasi`);
      setCaption("");
      router.refresh();
    }
    if (failed > 0) {
      toast("error", `${failed} media gagal diunggah`);
    }
  }

  const pending = items.filter((i) => !i.error && !i.done).length;

  return (
    <div className="rounded-lg border border-wood/15 bg-cream p-5">
      <h2 className="font-display text-lg font-semibold text-forest">Unggah Media</h2>
      <p className="mt-1 text-sm text-muted">
        Unggahan baru otomatis berstatus tertunda dan perlu disetujui sebelum tampil publik.
      </p>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          addFiles(e.dataTransfer.files);
        }}
        className="mt-4 rounded-lg border-2 border-dashed border-wood/25 bg-parchment/40 px-6 py-10 text-center"
      >
        <p className="text-sm text-muted">Seret berkas ke sini, atau</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-3 rounded-md bg-forest px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft"
        >
          Pilih Foto
        </button>
        <p className="mt-2 text-xs text-muted">JPG, PNG, atau WebP · maksimal 5MB per berkas</p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          multiple
          className="sr-only"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
          aria-label="Pilih foto untuk diunggah"
        />
      </div>

      <div className="mt-4">
        <label htmlFor="media-caption" className="block text-sm font-medium text-forest">
          Keterangan (opsional, berlaku untuk semua berkas)
        </label>
        <input
          id="media-caption"
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Mis: Foto bersama di halaman rumah"
          className="mt-1 block w-full rounded-md border border-wood/30 bg-cream px-4 py-2.5 text-sm text-forest placeholder:text-muted/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
        />
      </div>

      {items.length > 0 && (
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {items.map((item) => (
            <li
              key={item.key}
              className="relative overflow-hidden rounded-md border border-wood/15 bg-parchment/40"
            >
              {item.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.preview}
                  alt={item.file.name}
                  className={`h-24 w-full object-cover ${item.done ? "opacity-60" : ""}`}
                />
              ) : (
                <div className="grid h-24 w-full place-items-center text-xs text-muted">
                  Tidak bisa pratinjau
                </div>
              )}
              <p className="truncate px-2 py-1 text-[10px] text-muted" title={item.file.name}>
                {item.file.name}
              </p>
              {item.error && (
                <p className="px-2 pb-2 text-[10px] font-medium text-wood">{item.error}</p>
              )}
              {item.done && (
                <p className="px-2 pb-2 text-[10px] font-medium text-forest">Terkirim</p>
              )}
              {!item.done && !uploading && (
                <button
                  type="button"
                  onClick={() => removeItem(item.key)}
                  aria-label={`Keluarkan ${item.file.name}`}
                  className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-ink/60 text-xs text-cream hover:bg-ink"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={uploadAll}
          disabled={uploading || pending === 0}
          className="rounded-md bg-gold px-5 py-2.5 text-sm font-semibold text-forest transition-colors hover:bg-gold-deep disabled:opacity-50"
        >
          {uploading ? "Mengunggah…" : `Unggah${pending > 0 ? ` ${pending} Berkas` : ""}`}
        </button>
        {items.some((i) => !i.done && !i.error) && !uploading && (
          <button
            type="button"
            onClick={() => {
              items.forEach((i) => i.preview && URL.revokeObjectURL(i.preview));
              setItems([]);
            }}
            className="rounded-md border border-wood/30 px-4 py-2.5 text-sm text-muted transition-colors hover:bg-wood/10"
          >
            Kosongkan
          </button>
        )}
      </div>
    </div>
  );
}
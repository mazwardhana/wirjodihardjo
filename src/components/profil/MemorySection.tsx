"use client";

import { useState } from "react";
import { FiFileText, FiMic, FiFile, FiImage } from "react-icons/fi";

export type MemoryItem = {
  id: string;
  kind: string;
  title: string;
  content: string | null;
  fileUrl: string | null;
  thumbnailUrl: string | null;
  status: string;
  createdAt: string;
};

const KIND_ICON: Record<string, typeof FiFileText> = {
  STORY: FiFileText,
  AUDIO: FiMic,
  DOCUMENT: FiFile,
  IMAGE: FiImage,
};

const KIND_LABEL: Record<string, string> = {
  STORY: "Cerita",
  AUDIO: "Audio",
  DOCUMENT: "Dokumen",
  IMAGE: "Gambar",
};

// mime yang sama dengan yang diterima route /api/person/[id]/memories, agar
// berkas yang pasti ditolak server tidak perlu diunggah sampai selesai.
const ACCEPTED_MIMES = [
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
].join(",");

// Cerita lebih panjang dari ini dianggap perlu tombol buka-tutup, supaya
// daftar memori tetap sekilas terbaca.
const LONG_STORY_CHARS = 320;

function kindFromFile(type: string): string | null {
  if (type.startsWith("audio/")) return "AUDIO";
  if (type === "application/pdf") return "DOCUMENT";
  if (type.startsWith("image/")) return "IMAGE";
  return null;
}

function MemoryRow({ memory }: { memory: MemoryItem }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = KIND_ICON[memory.kind] ?? FiFileText;
  const longStory = (memory.content?.length ?? 0) > LONG_STORY_CHARS;
  const waiting = memory.status !== "APPROVED";

  return (
    <article className="rounded-lg border border-wood/15 bg-cream p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-md bg-parchment text-wood">
          <Icon aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-semibold text-forest">{memory.title}</h3>
            <span className="rounded-full bg-wood/10 px-2 py-0.5 text-[10px] text-wood">
              {KIND_LABEL[memory.kind] ?? memory.kind}
            </span>
            {waiting && (
              <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-xs text-gold-deep">
                Menunggu moderasi
              </span>
            )}
          </div>

          {memory.content && (
            <>
              <p
                className={`mt-2 whitespace-pre-line text-sm text-ink ${expanded ? "" : "line-clamp-6"}`}
              >
                {memory.content}
              </p>
              {longStory && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="mt-1 inline-flex min-h-11 items-center text-sm font-medium text-forest underline-offset-2 hover:underline"
                >
                  {expanded ? "Tutup" : "Baca selengkapnya"}
                </button>
              )}
            </>
          )}

          {memory.kind === "AUDIO" && memory.fileUrl && (
            // preload="none" agar rekaman besar tidak diunduh diam-diam.
            <audio controls preload="none" src={memory.fileUrl} className="mt-3 w-full">
              <track kind="captions" />
            </audio>
          )}

          {memory.kind === "DOCUMENT" && memory.fileUrl && (
            <a
              href={memory.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex min-h-11 items-center rounded-sm border border-wood/35 px-4 py-2.5 text-sm font-semibold text-wood transition-colors hover:bg-wood/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
            >
              <FiFile aria-hidden="true" className="mr-2 size-4" />
              Buka dokumen
            </a>
          )}

          {memory.kind === "IMAGE" && memory.fileUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={memory.thumbnailUrl ?? memory.fileUrl}
              alt={memory.title}
              width={480}
              height={320}
              loading="lazy"
              className="mt-3 h-auto w-full max-w-sm rounded-md"
            />
          )}
        </div>
      </div>
    </article>
  );
}

export function MemorySection({
  personId,
  memories,
  canSubmit,
}: {
  personId: string;
  memories: MemoryItem[];
  canSubmit: boolean;
}) {
  const [mode, setMode] = useState<"STORY" | "FILE">("STORY");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess("");
    setError("");

    const form = new FormData();
    form.append("title", title);
    let kind = "STORY";
    if (mode === "FILE") {
      if (!file) {
        setError("Pilih berkas terlebih dahulu.");
        return;
      }
      kind = kindFromFile(file.type) ?? "";
      if (!kind) {
        setError("Format berkas harus MP3, M4A, OGG, WAV, PDF, JPG, PNG, atau WebP.");
        return;
      }
    }
    form.append("kind", kind);
    if (mode === "STORY") form.append("content", content);
    if (mode === "FILE" && file) form.append("file", file);

    setBusy(true);
    try {
      const res = await fetch(`/api/person/${personId}/memories`, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setError("Terlalu banyak unggahan. Coba lagi dalam satu jam.");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Gagal mengirim memori. Coba lagi.");
        return;
      }
      setSuccess("Terima kasih, memori terkirim dan menunggu moderasi.");
      setTitle("");
      setContent("");
      setFile(null);
      setMode("STORY");
    } catch {
      setError("Gagal mengirim memori. Periksa koneksi lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="memori-heading">
      <h2 id="memori-heading" className="font-display text-xl font-semibold text-forest">
        Memori
      </h2>

      {memories.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-wood/25 bg-parchment/40 px-6 py-8 text-center text-sm text-muted">
          Belum ada memori untuk beliau.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {memories.map((memory) => (
            <MemoryRow key={memory.id} memory={memory} />
          ))}
        </div>
      )}

      {canSubmit && (
        <form
          onSubmit={submit}
          className="mt-6 rounded-lg border border-wood/15 bg-cream p-4 sm:p-5"
        >
          <h3 className="font-display text-base font-semibold text-forest">Kirim memori</h3>
          <p className="mt-1 text-sm text-muted">
            Bagikan cerita, rekaman suara, atau dokumen. Kiriman akan tampil setelah dimoderasi.
          </p>

          <div className="mt-4 flex gap-2" role="group" aria-label="Jenis kiriman">
            {(
              [
                { key: "STORY", label: "Tulis cerita" },
                { key: "FILE", label: "Unggah berkas" },
              ] as const
            ).map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setMode(option.key)}
                aria-pressed={mode === option.key}
                className={`min-h-11 rounded-sm border px-4 text-sm font-semibold transition-colors ${
                  mode === option.key
                    ? "border-forest bg-forest/10 text-forest"
                    : "border-wood/30 text-muted hover:bg-wood/10"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <label htmlFor="memory-title" className="mt-4 block">
            <span className="text-sm font-medium text-forest">Judul</span>
            <input
              id="memory-title"
              type="text"
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-2 block min-h-11 w-full rounded-sm border border-wood/30 bg-cream px-3 text-base text-ink placeholder:text-muted/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
              placeholder="Misal: Kenangan arisan keluarga 1998"
            />
          </label>

          {mode === "STORY" ? (
            <label htmlFor="memory-content" className="mt-4 block">
              <span className="text-sm font-medium text-forest">Cerita</span>
              <textarea
                id="memory-content"
                required
                rows={5}
                maxLength={5000}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="mt-2 block w-full rounded-sm border border-wood/30 bg-cream px-3 py-2 text-base text-ink placeholder:text-muted/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                placeholder="Tuliskan kenangan bersama beliau..."
              />
            </label>
          ) : (
            <label htmlFor="memory-file" className="mt-4 block">
              <span className="text-sm font-medium text-forest">Berkas</span>
              <input
                id="memory-file"
                type="file"
                required
                accept={ACCEPTED_MIMES}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-2 block min-h-11 w-full rounded-sm border border-wood/30 bg-cream px-3 py-2 text-base text-ink file:mr-3 file:min-h-9 file:rounded-sm file:border-0 file:bg-parchment file:px-3 file:text-sm file:font-semibold file:text-wood"
              />
            </label>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-4 min-h-11 rounded-sm bg-forest px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:opacity-50"
          >
            {busy ? "Mengirim..." : "Kirim memori"}
          </button>

          {success && (
            <p role="status" className="mt-3 rounded-sm bg-forest/10 px-3 py-2 text-sm text-forest">
              {success}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-3 rounded-sm bg-gold/10 px-3 py-2 text-sm text-gold-deep">
              {error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}

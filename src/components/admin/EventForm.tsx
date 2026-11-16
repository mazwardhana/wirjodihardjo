"use client";

import { useState } from "react";
import { toast } from "@/components/ui/Toast";
import { FAMILY_EVENT_TYPE_OPTIONS } from "@/lib/calendar";

export type EventFormValues = {
  id?: string;
  title: string;
  type: string;
  startsAt: string; // datetime-local
  endsAt: string;
  locationName: string;
  description: string;
  repeatYearly: boolean;
  isPublished: boolean;
};

const empty: EventFormValues = {
  title: "",
  type: "LAINNYA",
  startsAt: "",
  endsAt: "",
  locationName: "",
  description: "",
  repeatYearly: false,
  isPublished: false,
};

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EventForm({
  initial,
  isEdit = false,
  onSuccess,
  onCancel,
}: {
  initial?: Partial<EventFormValues>;
  isEdit?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState<EventFormValues>({
    ...empty,
    ...initial,
    startsAt: initial?.startsAt ? toLocalInput(initial.startsAt) : "",
    endsAt: initial?.endsAt ? toLocalInput(initial.endsAt) : "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const endpoint = isEdit ? `/api/admin/kalender/${initial?.id}` : "/api/admin/kalender";
      const method = isEdit ? "PUT" : "POST";
      const body: Record<string, unknown> = {
        title: form.title,
        type: form.type,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
        locationName: form.locationName || undefined,
        description: form.description || undefined,
        repeatYearly: form.repeatYearly,
        isPublished: form.isPublished,
      };
      if (isEdit && initial?.id) body.id = initial.id;

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal menyimpan");
      toast("success", isEdit ? "Event diperbarui" : "Event dibuat");
      if (onSuccess) onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "mt-1 block min-h-11 w-full rounded-md border border-wood/30 bg-cream px-4 py-2.5 text-sm text-forest placeholder:text-muted/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30";
  const labelCls = "block text-sm font-medium text-forest";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <p role="alert" className="rounded-md bg-wood/10 px-3 py-2 text-sm text-wood">{error}</p>}

      <div>
        <label htmlFor="title" className={labelCls}>Judul Event</label>
        <input
          id="title"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          className={inputCls}
          required
          placeholder="Contoh: Milad Ibu Siti"
        />
      </div>

      <div>
        <label htmlFor="type" className={labelCls}>Tipe Event</label>
        <select
          id="type"
          value={form.type}
          onChange={(e) => set("type", e.target.value)}
          className={inputCls}
        >
          {FAMILY_EVENT_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="startsAt" className={labelCls}>Tanggal Mulai</label>
          <input
            id="startsAt"
            type="datetime-local"
            value={form.startsAt}
            onChange={(e) => set("startsAt", e.target.value)}
            className={inputCls}
            required
          />
        </div>
        <div>
          <label htmlFor="endsAt" className={labelCls}>Tanggal Selesai (opsional)</label>
          <input
            id="endsAt"
            type="datetime-local"
            value={form.endsAt}
            onChange={(e) => set("endsAt", e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label htmlFor="locationName" className={labelCls}>Lokasi (opsional)</label>
        <input
          id="locationName"
          value={form.locationName}
          onChange={(e) => set("locationName", e.target.value)}
          className={inputCls}
          placeholder="Gedung Serbaguna, Hotel, dll."
        />
      </div>

      <div>
        <label htmlFor="description" className={labelCls}>Deskripsi (opsional)</label>
        <textarea
          id="description"
          rows={3}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          className={inputCls}
          placeholder="Informasi tambahan tentang acara..."
        />
      </div>

      <label className="flex items-center gap-3 text-sm text-forest">
        <input
          type="checkbox"
          checked={form.repeatYearly}
          onChange={(e) => set("repeatYearly", e.target.checked)}
          className="size-4 rounded border-wood/40 text-forest focus:ring-gold"
        />
        Berulang tiap tahun (milad / haul)
      </label>

      <label className="flex items-center gap-3 text-sm text-forest">
        <input
          type="checkbox"
          checked={form.isPublished}
          onChange={(e) => set("isPublished", e.target.checked)}
          className="size-4 rounded border-wood/40 text-forest focus:ring-gold"
        />
        Terbitkan (tampilkan untuk member)
      </label>

      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-md border border-wood/30 px-4 py-2 text-sm font-semibold text-forest transition-colors hover:bg-forest/5"
          >
            Batal
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className="min-h-11 rounded-md bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-gold-deep disabled:opacity-50"
        >
          {saving ? "Menyimpan..." : isEdit ? "Simpan" : "Buat Event"}
        </button>
      </div>
    </form>
  );
}
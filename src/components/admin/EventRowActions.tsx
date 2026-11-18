"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EventEditModal } from "./EventModals";

type RowEvent = {
  id: string;
  title: string;
  type: string;
  startsAt: string;
  endsAt: string | null;
  locationName: string | null;
  description: string | null;
  repeatYearly: boolean;
  isPublished: boolean;
};

export function EventRowActions({ event }: { event: RowEvent }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function togglePublish() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/kalender/${event.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !event.isPublished }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Gagal memperbarui");
      }
      toast("success", event.isPublished ? "Event diturunkan" : "Event terbit");
      router.refresh();
    } catch (err) {
      toast("error", (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/kalender/${event.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Gagal menghapus");
      }
      toast("success", "Event dihapus");
      router.refresh();
    } catch (err) {
      toast("error", (err as Error).message);
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  return (
    <>
      <div className="flex shrink-0 flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="min-h-10 rounded-md border border-wood/30 px-3 py-1.5 text-xs font-semibold text-forest transition-colors hover:bg-forest/5"
        >
          Ubah
        </button>
        <button
          type="button"
          onClick={togglePublish}
          disabled={busy}
          className="min-h-10 rounded-md border border-forest/30 px-3 py-1.5 text-xs font-semibold text-forest transition-colors hover:bg-forest/5 disabled:opacity-50"
        >
          {event.isPublished ? "Turunkan" : "Terbitkan"}
        </button>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="min-h-10 rounded-md border border-wood/40 px-3 py-1.5 text-xs font-semibold text-wood transition-colors hover:bg-wood/10"
        >
          Hapus
        </button>
      </div>

      {editing && (
        <EventEditModal event={event} onDone={() => { setEditing(false); router.refresh(); }} />
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Hapus event?"
        message={`"${event.title}" akan dihapus beserta semua RSVP-nya.`}
        confirmLabel="Hapus"
      />
    </>
  );
}
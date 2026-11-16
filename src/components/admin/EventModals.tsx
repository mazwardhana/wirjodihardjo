"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { EventForm, type EventFormValues } from "./EventForm";

export function EventCreateModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 rounded-md bg-gold px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-gold-deep"
      >
        Event Baru
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Buat Event Keluarga"
        description="Tambahkan milad, haul, reuni, atau acara keluarga lainnya."
        size="xl"
      >
        <EventForm
          isEdit={false}
          onSuccess={() => {
            setOpen(false);
            router.refresh();
          }}
          onCancel={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}

export function EventEditModal({
  event,
  onDone,
}: {
  event: { id: string; title: string; type: string; startsAt: string; endsAt: string | null; locationName: string | null; description: string | null; repeatYearly: boolean; isPublished: boolean } | null;
  onDone: () => void;
}) {
  const router = useRouter();
  if (!event) return null;
  return (
    <Dialog open={!!event} onClose={onDone} title="Ubah Event" size="xl">
      <EventForm
        isEdit
        initial={{
          id: event.id,
          title: event.title,
          type: event.type,
          startsAt: event.startsAt,
          endsAt: event.endsAt ?? "",
          locationName: event.locationName ?? "",
          description: event.description ?? "",
          repeatYearly: event.repeatYearly,
          isPublished: event.isPublished,
        }}
        onSuccess={onDone}
        onCancel={onDone}
      />
    </Dialog>
  );
}
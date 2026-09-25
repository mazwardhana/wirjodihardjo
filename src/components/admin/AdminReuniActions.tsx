"use client";

import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toast";

const transitions: Record<string, string[]> = {
  DRAFT: ["PUBLISHED", "CANCELLED"],
  PUBLISHED: ["COMPLETED", "CANCELLED"],
  CANCELLED: ["DRAFT", "PUBLISHED"],
  COMPLETED: [],
};

const statusLabels: Record<string, string> = {
  DRAFT: "Draf",
  PUBLISHED: "Terbitkan",
  CANCELLED: "Batalkan",
  COMPLETED: "Tandai selesai",
};

export function AdminReuniActions({
  id,
  status,
  editHref,
}: {
  id: string;
  status: string;
  editHref: string;
}) {
  const router = useRouter();

  async function changeStatus(newStatus: string) {
    if (!confirm(`Ubah status reuni ini menjadi "${statusLabels[newStatus]}"?`)) return;
    try {
      const res = await fetch("/api/admin/reuni", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal mengubah status");
      toast("success", `Status diubah menjadi ${statusLabels[newStatus]}`);
      router.refresh();
    } catch (err) {
      toast("error", (err as Error).message);
    }
  }

  async function deleteReuni() {
    if (!confirm("Hapus reuni ini? Semua data pendaftaran akan ikut terhapus.")) return;
    try {
      const res = await fetch(`/api/admin/reuni?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal menghapus");
      toast("success", "Reuni dihapus");
      router.refresh();
    } catch (err) {
      toast("error", (err as Error).message);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {transitions[status]?.map((next) => (
        <button
          key={next}
          type="button"
          onClick={() => changeStatus(next)}
          className="rounded-md border border-wood/20 px-3 py-1.5 text-xs font-medium text-forest transition-colors hover:bg-wood/10"
        >
          {statusLabels[next]}
        </button>
      ))}
      <button
        type="button"
        onClick={deleteReuni}
        className="rounded-md border border-wood/20 px-3 py-1.5 text-xs text-wood transition-colors hover:bg-wood/10"
      >
        Hapus
      </button>
    </div>
  );
}
"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/utils";

type Registration = {
  id: string;
  guestCount: number;
  notes: string | null;
  status: string;
  createdAt: string;
  user: {
    id: string;
    person: { fullName: string };
  };
};

export function ReunionRegistrations({
  registrations,
  reunionId,
}: {
  registrations: Registration[];
  reunionId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const handleCancel = useCallback(async (regId: string) => {
    setBusy(regId);
    try {
      const res = await fetch("/api/admin/reuni/registrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: regId, status: "CANCELLED" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal membatalkan");
      toast("success", "Pendaftaran dibatalkan");
      router.refresh();
    } catch (err) {
      toast("error", (err as Error).message);
    } finally {
      setBusy(null);
    }
  }, [router]);

  const handleConfirm = useCallback(async (regId: string) => {
    setBusy(regId);
    try {
      const res = await fetch("/api/admin/reuni/registrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: regId, status: "CONFIRMED" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal mengonfirmasi");
      toast("success", "Pendaftaran dikonfirmasi");
      router.refresh();
    } catch (err) {
      toast("error", (err as Error).message);
    } finally {
      setBusy(null);
    }
  }, [router]);

  if (registrations.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-wood/30 bg-parchment/40 px-6 py-10 text-center text-sm text-muted">
        Belum ada pendaftar.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-wood/15 text-xs font-medium uppercase tracking-wide text-muted">
            <th className="pb-3 pr-4">Nama</th>
            <th className="pb-3 pr-4">Tamu</th>
            <th className="pb-3 pr-4">Status</th>
            <th className="pb-3 pr-4">Catatan</th>
            <th className="pb-3 pr-4">Tanggal Daftar</th>
            <th className="pb-3 pr-4">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {registrations.map((reg) => (
            <tr key={reg.id} className="border-b border-wood/10">
              <td className="py-3 pr-4 font-medium text-forest">
                {reg.user.person.fullName}
              </td>
              <td className="py-3 pr-4 text-muted">{reg.guestCount}</td>
              <td className="py-3 pr-4">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    reg.status === "CONFIRMED"
                      ? "bg-forest/10 text-forest"
                      : reg.status === "CANCELLED"
                        ? "bg-wood/10 text-wood"
                        : "bg-gold/10 text-gold-deep"
                  }`}
                >
                  {reg.status === "CONFIRMED"
                    ? "Terdaftar"
                    : reg.status === "CANCELLED"
                      ? "Dibatalkan"
                      : "Waitlist"}
                </span>
              </td>
              <td className="py-3 pr-4 text-muted">
                {reg.notes || <span className="italic opacity-50">-</span>}
              </td>
              <td className="py-3 pr-4 text-muted text-xs">
                {formatDate(reg.createdAt)}
              </td>
              <td className="py-3 pr-4">
                {reg.status === "CONFIRMED" && (
                  <button
                    type="button"
                    disabled={busy === reg.id}
                    onClick={() => handleCancel(reg.id)}
                    className="text-xs text-wood underline hover:text-wood-soft disabled:opacity-50"
                  >
                    {busy === reg.id ? "..." : "Batalkan"}
                  </button>
                )}
                {reg.status === "CANCELLED" && (
                  <button
                    type="button"
                    disabled={busy === reg.id}
                    onClick={() => handleConfirm(reg.id)}
                    className="text-xs text-forest underline hover:text-gold-deep disabled:opacity-50"
                  >
                    {busy === reg.id ? "..." : "Konfirmasi"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
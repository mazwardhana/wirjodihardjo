"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/utils";

type Registration = {
  id: string;
  personId: string | null;
  guestCount: number;
  notes: string | null;
  status: string;
  attendance: string;
  createdAt: string;
  fullName: string;
  branchName: string | null;
};

const attendanceButton =
  "min-h-11 rounded-sm border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest";
const attendanceActive = "border-forest bg-forest/10 text-forest";
const attendanceIdle = "border-wood/30 text-muted hover:bg-wood/10";

export function ReunionRegistrations({
  registrations,
}: {
  registrations: Registration[];
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

  // Kehadiran diisi panitia di meja pendaftaran, terpisah dari status pendaftaran:
  // orang bisa tetap "Terdaftar" tapi tidak jadi datang.
  const handleAttendance = useCallback(async (
    regId: string,
    attendance: "ATTENDING" | "NOT_ATTENDING",
  ) => {
    setBusy(regId);
    try {
      const res = await fetch("/api/admin/reuni/registrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: regId, attendance }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal menyimpan kehadiran");
      toast(
        "success",
        attendance === "ATTENDING"
          ? "Peserta ditandai hadir"
          : "Peserta ditandai tidak ikut",
      );
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
            <th className="pb-3 pr-4">Keluarga cabang</th>
            <th className="pb-3 pr-4">Tamu</th>
            <th className="pb-3 pr-4">Status</th>
            <th className="pb-3 pr-4">Kehadiran</th>
            <th className="pb-3 pr-4">Catatan</th>
            <th className="pb-3 pr-4">Tanggal Daftar</th>
            <th className="pb-3 pr-4">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {registrations.map((reg) => {
            const attending = reg.attendance === "ATTENDING";
            return (
            <tr key={reg.id} className="border-b border-wood/10">
              <td className="py-3 pr-4 font-medium text-forest">
                {reg.fullName}
              </td>
              <td className="py-3 pr-4 text-muted">
                {reg.branchName ?? <span className="italic opacity-70">Belum ditugaskan</span>}
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
              <td className="py-3 pr-4">
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    aria-pressed={attending}
                    disabled={busy === reg.id}
                    onClick={() => handleAttendance(reg.id, "ATTENDING")}
                    className={`${attendanceButton} ${attending ? attendanceActive : attendanceIdle}`}
                  >
                    Hadir
                  </button>
                  <button
                    type="button"
                    aria-pressed={!attending}
                    disabled={busy === reg.id}
                    onClick={() => handleAttendance(reg.id, "NOT_ATTENDING")}
                    className={`${attendanceButton} ${attending ? attendanceIdle : attendanceActive}`}
                  >
                    Tidak ikut
                  </button>
                </div>
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
                    className="min-h-11 text-xs text-wood underline hover:text-wood-soft disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                  >
                    {busy === reg.id ? "..." : "Batalkan"}
                  </button>
                )}
                {reg.status === "CANCELLED" && (
                  <button
                    type="button"
                    disabled={busy === reg.id}
                    onClick={() => handleConfirm(reg.id)}
                    className="min-h-11 text-xs text-forest underline hover:text-gold-deep disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                  >
                    {busy === reg.id ? "..." : "Konfirmasi"}
                  </button>
                )}
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
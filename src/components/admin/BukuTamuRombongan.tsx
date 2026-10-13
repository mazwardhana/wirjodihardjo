"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "@/components/ui/Toast";

type GroupMember = {
  registrationId: string;
  fullName: string;
  namaPanggilan: string | null;
  branchName: string | null;
  hasAccount: boolean;
};

type Group = {
  groupId: string;
  checkedInAt: string | null;
  source: string | null;
  members: GroupMember[];
};

type PendingAccount = {
  personId: string;
  fullName: string;
  namaPanggilan: string | null;
  checkedInAt: string;
};

const badge =
  "rounded-full px-2 py-0.5 text-xs font-medium min-h-11 inline-flex items-center sm:min-h-0";

export function BukuTamuRombongan({ reunionId }: { reunionId: string }) {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [pending, setPending] = useState<PendingAccount[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [usernames, setUsernames] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/reuni/checkin?reunionId=${reunionId}`);
    if (!res.ok) {
      setGroups([]);
      setPending([]);
      toast("error", "Gagal memuat buku tamu");
      return;
    }
    const data = (await res.json()) as {
      groups: Group[];
      pendingAccounts: PendingAccount[];
    };
    setGroups(data.groups);
    setPending(data.pendingAccounts);
  }, [reunionId]);

  useEffect(() => {
    // Dijalankan lewat tunda singkat agar setState tidak sinkron di badan efek
    // (aturan react-hooks/set-state-in-effect).
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  // Setujui akun tamu baru: buat akun MEMBER lalu tampilkan username hasilnya.
  const handleApprove = useCallback(
    async (personId: string) => {
      setBusy(personId);
      try {
        const res = await fetch("/api/admin/reuni/checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "approve-account", personId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Gagal menyetujui akun");
        setUsernames((prev) => ({ ...prev, [personId]: data.username }));
        toast("success", `Akun dibuat: ${data.username}`);
        await load();
      } catch (err) {
        toast("error", (err as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [load],
  );

  // Batalkan absen satu orang: jejak absen dikosongkan, pendaftarannya tetap.
  const handleCancel = useCallback(
    async (registrationId: string, fullName: string) => {
      // Konfirmasi dulu: aksi ini menghapus jejak kehadiran orang di buku tamu.
      if (!confirm(`Batalkan absen ${fullName}? Jejak kehadirannya akan dikosongkan.`)) {
        return;
      }
      setBusy(registrationId);
      try {
        const res = await fetch("/api/admin/reuni/checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "cancel-checkin", registrationId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Gagal membatalkan absen");
        toast("success", "Absen dibatalkan");
        await load();
      } catch (err) {
        toast("error", (err as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [load],
  );

  if (groups === null || pending === null) {
    return (
      <p className="rounded-lg border border-dashed border-wood/30 bg-parchment/40 px-6 py-10 text-center text-sm text-muted">
        Memuat buku tamu...
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h3 className="font-display text-lg font-semibold text-forest">
          Perlu persetujuan akun
        </h3>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Tidak ada tamu baru yang menunggu persetujuan.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {pending.map((p) => (
              <li
                key={p.personId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-wood/15 bg-cream p-3"
              >
                <div>
                  <p className="font-medium text-forest">
                    {p.fullName}
                    {p.namaPanggilan ? (
                      <span className="text-muted"> ({p.namaPanggilan})</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted">
                    Tamu baru, absen {new Date(p.checkedInAt).toLocaleString("id-ID")}
                  </p>
                  {usernames[p.personId] ? (
                    <p className="text-xs font-medium text-forest">
                      Nama pengguna: {usernames[p.personId]}
                    </p>
                  ) : null}
                </div>
                {usernames[p.personId] ? null : (
                  <button
                    type="button"
                    disabled={busy === p.personId}
                    onClick={() => handleApprove(p.personId)}
                    className="min-h-11 rounded-sm bg-forest px-3 py-1.5 text-xs font-medium text-cream transition-colors hover:bg-forest-soft disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                  >
                    {busy === p.personId ? "..." : "Setujui & buat akun"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="font-display text-lg font-semibold text-forest">Rombongan</h3>
        {groups.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Belum ada yang absen.</p>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {groups.map((g, i) => (
              <div key={g.groupId} className="rounded-lg border border-wood/15 bg-cream p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-display font-semibold text-forest">Rombongan #{i + 1}</p>
                  <p className="text-xs text-muted">
                    {new Date(g.checkedInAt ?? 0).toLocaleString("id-ID")}
                  </p>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {g.members.length} orang
                  {g.source === "QR_SELF" ? " via QR" : g.source === "ADMIN" ? " via panitia" : ""}
                </p>
                <ul className="mt-3 space-y-2">
                  {g.members.map((m) => (
                    <li key={m.registrationId} className="text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-forest">
                            {m.fullName}
                            {m.namaPanggilan ? (
                              <span className="font-normal text-muted"> ({m.namaPanggilan})</span>
                            ) : null}
                          </span>
                          <span
                            className={`${badge} ${
                              m.hasAccount
                                ? "bg-forest/10 text-ink"
                                : "bg-gold/20 text-gold-deep"
                            }`}
                          >
                            {m.hasAccount ? "terdaftar" : "tamu baru"}
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={busy === m.registrationId}
                          onClick={() => handleCancel(m.registrationId, m.fullName)}
                          className="min-h-11 text-xs text-wood underline hover:text-wood-soft disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                        >
                          {busy === m.registrationId ? "..." : "Batalkan absen"}
                        </button>
                      </div>
                      {m.branchName ? (
                        <p className="text-xs text-muted">{m.branchName}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

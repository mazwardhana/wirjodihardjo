"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function PenggunaDetail({ user }: { user: any }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newPassword, setNewPassword] = useState<string | null>(null);

  const { id, email, role, isActive, isVerified, mustChangePassword, person, createdBy, branchAdminOf, createdAt } = user;

  async function update(fields: Record<string, unknown>) {
    setBusy("update");
    try {
      const res = await fetch("/api/admin/pengguna", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...fields }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error((d as { error?: string }).error ?? "Gagal");
      toast("success", "Data pengguna diperbarui.");
      router.refresh();
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function resetPassword() {
    setBusy("reset");
    try {
      const res = await fetch("/api/admin/pengguna", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset-password", userId: id }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error((d as { error?: string }).error ?? "Gagal");
      setNewPassword((d as { newPassword: string }).newPassword);
      toast("success", "Password berhasil di-reset. Salin password baru sebelum menutup.");
      router.refresh();
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function deleteUser() {
    setBusy("delete");
    try {
      const res = await fetch(`/api/admin/pengguna?id=${id}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) throw new Error((d as { error?: string }).error ?? "Gagal");
      toast("success", "Akun dihapus.");
      router.push("/admin/pengguna");
      router.refresh();
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setBusy(null);
      setConfirmDelete(false);
    }
  }

  const labelCls = "block text-xs font-medium uppercase tracking-wide text-muted";

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-semibold text-forest">Detail Pengguna</h1>

      <dl className="mt-6 space-y-4 text-sm">
        <div>
          <dt className={labelCls}>Nama</dt>
          <dd className="mt-0.5 font-medium text-forest">{person?.fullName ?? "-"}</dd>
        </div>
        <div>
          <dt className={labelCls}>Email</dt>
          <dd className="mt-0.5 text-forest">{email}</dd>
        </div>
        <div>
          <dt className={labelCls}>Peran</dt>
          <dd className="mt-0.5">
            <select
              value={role}
              onChange={(e) => update({ role: e.target.value })}
              disabled={busy !== null}
              className="rounded-md border border-wood/25 bg-cream px-3 py-1.5 text-sm text-forest focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30"
            >
              <option value="MEMBER">Anggota</option>
              <option value="BRANCH_ADMIN">Admin Cabang</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
            {branchAdminOf && <span className="ml-2 text-xs text-muted">· {branchAdminOf.name}</span>}
          </dd>
        </div>
        <div>
          <dt className={labelCls}>Status</dt>
          <dd className="mt-0.5 flex gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isActive} onChange={(e) => update({ isActive: e.target.checked })} className="h-4 w-4 accent-forest" />
              Aktif
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isVerified} onChange={(e) => update({ isVerified: e.target.checked })} className="h-4 w-4 accent-forest" />
              Terverifikasi
            </label>
          </dd>
        </div>
        <div>
          <dt className={labelCls}>Password</dt>
          <dd className="mt-0.5">
            <button
              type="button"
              onClick={resetPassword}
              disabled={busy !== null}
              className="rounded-md border border-wood/25 px-3 py-1.5 text-xs text-muted transition-colors hover:bg-wood/10 disabled:opacity-50"
            >
              {busy === "reset" ? "Mereset..." : "Reset password"}
            </button>
            {newPassword && (
              <p className="mt-2 rounded-md bg-gold/10 p-3 text-xs font-medium text-gold-deep">
                Password baru: <code className="font-mono text-sm">{newPassword}</code>
                <br />Salin sebelum menutup halaman.
              </p>
            )}
          </dd>
        </div>
        <div>
          <dt className={labelCls}>Dibuat oleh</dt>
          <dd className="mt-0.5 text-forest">{createdBy?.person?.fullName ?? "Sistem"}</dd>
        </div>
        <div>
          <dt className={labelCls}>Tanggal daftar</dt>
          <dd className="mt-0.5 text-forest">{new Date(createdAt).toLocaleDateString("id-ID")}</dd>
        </div>
      </dl>

      <div className="mt-8 border-t border-wood/15 pt-6">
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          disabled={busy !== null}
          className="rounded-md border border-wood/30 px-4 py-2 text-sm font-medium text-wood transition-colors hover:bg-wood/10 disabled:opacity-50"
        >
          Hapus akun
        </button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={deleteUser}
        title="Hapus akun"
        message={`Akun ${email} akan dihapus permanen. Data anggota tetap tersimpan. Lanjutkan?`}
        confirmLabel="Hapus"
        variant="danger"
      />
    </div>
  );
}
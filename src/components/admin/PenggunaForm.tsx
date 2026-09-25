"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toast";

export function PenggunaForm({ persons }: { persons: { id: string; fullName: string }[] }) {
  const router = useRouter();
  const [personId, setPersonId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("MEMBER");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/admin/pengguna", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role, personId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error((d as { error?: string }).error ?? "Gagal");
      toast("success", `Akun untuk ${(d as any).person?.fullName ?? email} berhasil dibuat.`);
      router.push("/admin/pengguna");
      router.refresh();
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "mt-1 block w-full rounded-md border border-wood/30 bg-cream px-4 py-2.5 text-sm text-forest placeholder:text-muted/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30";
  const labelCls = "block text-sm font-medium text-forest";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="personId" className={labelCls}>Anggota</label>
        <select id="personId" value={personId} onChange={(e) => setPersonId(e.target.value)} className={inputCls} required>
          <option value="">Pilih anggota…</option>
          {persons.map((p) => (
            <option key={p.id} value={p.id}>{p.fullName}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="email" className={labelCls}>Email</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} required />
      </div>

      <div>
        <label htmlFor="password" className={labelCls}>Password</label>
        <input id="password" type="text" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} required minLength={6} placeholder="Minimal 6 karakter" />
      </div>

      <div>
        <label htmlFor="role" className={labelCls}>Peran</label>
        <select id="role" value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
          <option value="MEMBER">Anggota</option>
          <option value="BRANCH_ADMIN">Admin Cabang</option>
          <option value="SUPER_ADMIN">Super Admin</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-gold px-5 py-2.5 text-sm font-semibold text-forest transition-colors hover:bg-gold-deep disabled:opacity-50"
      >
        {busy ? "Menyimpan..." : "Buat Akun"}
      </button>
    </form>
  );
}
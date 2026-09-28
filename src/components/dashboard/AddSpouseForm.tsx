"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Form pengajuan penambahan pasangan.
 */
export function AddSpouseForm({ personId, personName }: { personId: string; personName: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"MALE" | "FEMALE" | "OTHER">("MALE");
  const [marriageDate, setMarriageDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/pengajuan/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "ADD_SPOUSE",
          personId,
          fullName: name,
          gender,
          marriageDate: marriageDate || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal mengajukan");
      router.push("/dashboard/pengajuan");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "mt-1 block w-full rounded-md border border-wood/30 bg-cream px-4 py-2.5 text-sm text-forest placeholder:text-muted/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <p className="text-sm text-muted">
          Pasangan dari: <span className="font-medium text-forest">{personName}</span>
        </p>
      </div>

      <div>
        <label htmlFor="spouse-name" className="block text-sm font-medium text-forest">Nama Lengkap Pasangan</label>
        <input id="spouse-name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} required />
      </div>

      <div>
        <label htmlFor="spouse-gender" className="block text-sm font-medium text-forest">Jenis Kelamin</label>
        <select id="spouse-gender" value={gender} onChange={(e) => setGender(e.target.value as any)} className={inputCls}>
          <option value="MALE">Laki-laki</option>
          <option value="FEMALE">Perempuan</option>
          <option value="OTHER">Lainnya</option>
        </select>
      </div>

      <div>
        <label htmlFor="spouse-marriage-date" className="block text-sm font-medium text-forest">Tanggal Menikah</label>
        <input
          type="date"
          id="spouse-marriage-date"
          value={marriageDate}
          onChange={(e) => setMarriageDate(e.target.value)}
          className={inputCls}
        />
      </div>

      {error && <p role="alert" className="rounded-md bg-wood/10 p-3 text-sm text-wood">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-gold px-5 py-2.5 text-sm font-semibold text-forest transition-colors hover:bg-gold-deep disabled:opacity-50"
      >
        {loading ? "Mengajukan..." : "Ajukan"}
      </button>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Form pengajuan pendaftaran anggota keluarga yang belum tercatat.
 */
export function AddPersonForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"MALE" | "FEMALE" | "OTHER">("MALE");
  const [birthDate, setBirthDate] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
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
          type: "ADD_PERSON",
          fullName: name,
          gender,
          birthDate: birthDate || undefined,
          birthPlace: birthPlace || undefined,
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
        <label htmlFor="person-name" className="block text-sm font-medium text-forest">Nama Lengkap</label>
        <input id="person-name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} required />
      </div>

      <div>
        <label htmlFor="person-gender" className="block text-sm font-medium text-forest">Jenis Kelamin</label>
        <select id="person-gender" value={gender} onChange={(e) => setGender(e.target.value as any)} className={inputCls}>
          <option value="MALE">Laki-laki</option>
          <option value="FEMALE">Perempuan</option>
          <option value="OTHER">Lainnya</option>
        </select>
      </div>

      <div>
        <label htmlFor="person-birth-date" className="block text-sm font-medium text-forest">Tanggal Lahir</label>
        <input
          type="date"
          id="person-birth-date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="person-birth-place" className="block text-sm font-medium text-forest">Tempat Lahir</label>
        <input
          id="person-birth-place"
          value={birthPlace}
          onChange={(e) => setBirthPlace(e.target.value)}
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

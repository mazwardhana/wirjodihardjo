"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PhotoUploader } from "@/components/ui/PhotoUploader";

type FormState = {
  id?: string;
  fullName: string;
  nickname: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  birthDate: string;
  birthPlace: string;
  isDeceased: boolean;
  deathDate: string;
  bio: string;
  branchId: string;
  generationLevel: string;
  photoUrl: string | null;
};

const empty: FormState = {
  fullName: "",
  nickname: "",
  gender: "MALE",
  birthDate: "",
  birthPlace: "",
  isDeceased: false,
  deathDate: "",
  bio: "",
  branchId: "",
  generationLevel: "",
  photoUrl: null,
};

export function AnggotaForm({
  branches,
  initial,
}: {
  branches: { id: string; name: string }[];
  initial?: Partial<FormState>;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({ ...empty, ...initial });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/anggota", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: form.id,
          fullName: form.fullName,
          nickname: form.nickname || undefined,
          gender: form.gender,
          birthDate: form.birthDate || undefined,
          birthPlace: form.birthPlace || undefined,
          isDeceased: form.isDeceased,
          deathDate: form.deathDate || undefined,
          bio: form.bio || undefined,
          branchId: form.branchId || undefined,
          generationLevel: form.generationLevel || undefined,
          photoUrl: form.photoUrl ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal menyimpan");
      router.push("/admin/anggota");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  const inputCls =
    "mt-1 block w-full rounded-md border border-wood/30 bg-cream px-4 py-2.5 text-sm text-forest placeholder:text-muted/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30";
  const labelCls = "block text-sm font-medium text-forest";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {form.id !== undefined && (
        <PhotoUploader
          currentPhotoUrl={form.photoUrl}
          personName={form.fullName || "Anggota"}
          onPhotoChange={(url) => set("photoUrl", url)}
        />
      )}

      <div>
        <label htmlFor="fullName" className={labelCls}>Nama Lengkap</label>
        <input id="fullName" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} className={inputCls} required />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="nickname" className={labelCls}>Nama Panggilan</label>
          <input id="nickname" value={form.nickname} onChange={(e) => set("nickname", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label htmlFor="gender" className={labelCls}>Jenis Kelamin</label>
          <select id="gender" value={form.gender} onChange={(e) => set("gender", e.target.value as FormState["gender"])} className={inputCls}>
            <option value="MALE">Laki-laki</option>
            <option value="FEMALE">Perempuan</option>
            <option value="OTHER">Lainnya</option>
          </select>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="birthDate" className={labelCls}>Tanggal Lahir</label>
          <input id="birthDate" type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label htmlFor="birthPlace" className={labelCls}>Tempat Lahir</label>
          <input id="birthPlace" value={form.birthPlace} onChange={(e) => set("birthPlace", e.target.value)} className={inputCls} />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="branchId" className={labelCls}>Cabang</label>
          <select id="branchId" value={form.branchId} onChange={(e) => set("branchId", e.target.value)} className={inputCls}>
            <option value="">Tanpa cabang</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="generationLevel" className={labelCls}>Level Generasi</label>
          <input id="generationLevel" type="number" min="0" value={form.generationLevel} onChange={(e) => set("generationLevel", e.target.value)} className={inputCls} placeholder="Otomatis bila kosong" />
        </div>
      </div>

      <label className="flex items-center gap-3 rounded-md border border-wood/20 bg-parchment/40 p-4">
        <input
          type="checkbox"
          checked={form.isDeceased}
          onChange={(e) => set("isDeceased", e.target.checked)}
          className="h-4 w-4 accent-forest"
        />
        <span className="text-sm text-muted">Tandai sebagai almarhum/almarhumah</span>
      </label>

      {form.isDeceased && (
        <div>
          <label htmlFor="deathDate" className={labelCls}>Tanggal Wafat</label>
          <input id="deathDate" type="date" value={form.deathDate} onChange={(e) => set("deathDate", e.target.value)} className={inputCls} />
        </div>
      )}

      <div>
        <label htmlFor="bio" className={labelCls}>Bio</label>
        <textarea id="bio" rows={3} value={form.bio} onChange={(e) => set("bio", e.target.value)} className={inputCls} />
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-wood/10 p-3 text-sm text-wood">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-gold px-5 py-2.5 text-sm font-semibold text-forest transition-colors hover:bg-gold-deep disabled:opacity-50"
        >
          {saving ? "Menyimpan..." : form.id ? "Simpan Perubahan" : "Simpan Anggota"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-wood/30 px-5 py-2.5 text-sm text-muted transition-colors hover:bg-wood/10"
        >
          Batal
        </button>
      </div>
    </form>
  );
}
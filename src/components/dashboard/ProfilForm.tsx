"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PhotoUploader } from "@/components/ui/PhotoUploader";
import { signOut } from "@/lib/auth-client";

type Initial = {
  fullName: string;
  nickname: string;
  bio: string;
  photoUrl: string | null;
  phone: string;
  whatsapp: string;
  addressLine: string;
  city: string;
  visibleToMembers: boolean;
};

export function ProfilForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [photoUrl, setPhotoUrl] = useState<string | null>(initial.photoUrl);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  function set<K extends keyof Initial>(key: K, value: Initial[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setMessage(null);

    try {
      const res = await fetch("/api/profil/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          nickname: form.nickname,
          bio: form.bio,
          phone: form.phone,
          whatsapp: form.whatsapp,
          addressLine: form.addressLine,
          city: form.city,
          visibleToMembers: form.visibleToMembers,
        }),
      });
      if (!res.ok) throw new Error();
      setStatus("saved");
      setMessage("Profil berhasil disimpan.");
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("Gagal menyimpan. Coba lagi.");
    }
  }

  const inputCls =
    "mt-1 block w-full rounded-md border border-wood/30 bg-cream px-4 py-2.5 text-sm text-forest placeholder:text-muted/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30";

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Foto */}
      <section>
        <h2 className="font-display text-lg font-semibold text-forest">
          Foto Profil
        </h2>
        <p className="mb-4 text-sm text-muted">
          Foto ini juga tampil pada simpul Anda di pohon silsilah.
        </p>
        <PhotoUploader
          currentPhotoUrl={photoUrl}
          personName={form.fullName}
          onPhotoChange={(url) => {
            setPhotoUrl(url);
            set("photoUrl", url);
            router.refresh();
          }}
        />
      </section>

      {/* Data publik */}
      <section className="border-t border-wood/15 pt-6">
        <h2 className="font-display text-lg font-semibold text-forest">
          Data Publik
        </h2>
        <p className="mb-4 text-sm text-muted">
          Dapat dilihat siapa saja yang membuka silsilah.
        </p>
        <div className="space-y-5">
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-forest">
              Nama Lengkap
            </label>
            <input
              id="fullName"
              value={form.fullName}
              onChange={(e) => set("fullName", e.target.value)}
              className={inputCls}
              required
            />
          </div>
          <div>
            <label htmlFor="nickname" className="block text-sm font-medium text-forest">
              Nama Panggilan
            </label>
            <input
              id="nickname"
              value={form.nickname}
              onChange={(e) => set("nickname", e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="bio" className="block text-sm font-medium text-forest">
              Bio Singkat
            </label>
            <textarea
              id="bio"
              rows={3}
              value={form.bio}
              onChange={(e) => set("bio", e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
      </section>

      {/* Data privat */}
      <section className="border-t border-wood/15 pt-6">
        <h2 className="font-display text-lg font-semibold text-forest">
          Data Kontak
        </h2>
        <p className="mb-4 text-sm text-muted">
          Hanya terlihat oleh anggota keluarga yang sudah login.
        </p>
        <div className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-forest">
                Telepon
              </label>
              <input
                id="phone"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="whatsapp" className="block text-sm font-medium text-forest">
                WhatsApp
              </label>
              <input
                id="whatsapp"
                value={form.whatsapp}
                onChange={(e) => set("whatsapp", e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label htmlFor="addressLine" className="block text-sm font-medium text-forest">
              Alamat
            </label>
            <input
              id="addressLine"
              value={form.addressLine}
              onChange={(e) => set("addressLine", e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="city" className="block text-sm font-medium text-forest">
              Kota
            </label>
            <input
              id="city"
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              className={inputCls}
            />
          </div>

          <label className="flex items-start gap-3 rounded-md border border-wood/20 bg-parchment/40 p-4">
            <input
              type="checkbox"
              checked={form.visibleToMembers}
              onChange={(e) => set("visibleToMembers", e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-forest"
            />
            <span className="text-sm text-muted">
              Tampilkan data kontak saya kepada seluruh anggota keluarga yang
              login.
            </span>
          </label>
        </div>
      </section>

      {message && (
        <p
          role="status"
          aria-live="polite"
          className={`rounded-md px-4 py-3 text-sm font-medium ${
            status === "error"
              ? "bg-wood/10 text-wood"
              : "bg-forest/10 text-forest"
          }`}
        >
          {message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-wood/15 pt-6">
        <button
          type="submit"
          disabled={status === "saving"}
          className="rounded-md bg-gold px-5 py-2.5 text-sm font-semibold text-forest transition-colors hover:bg-gold-deep disabled:opacity-50"
        >
          {status === "saving" ? "Menyimpan..." : "Simpan Profil"}
        </button>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="rounded-md border border-wood/30 px-5 py-2.5 text-sm text-muted transition-colors hover:bg-wood/10"
        >
          Keluar
        </button>
      </div>
    </form>
  );
}
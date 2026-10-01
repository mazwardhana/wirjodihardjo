"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { toast } from "@/components/ui/Toast";

type EditForm = {
  fullName: string;
  nickname: string;
  namaPanggilan: string;
  gender: string;
  birthPlace: string;
  birthDate: string;
  phone: string;
  addressLine: string;
  city: string;
};

const inputCls =
  "mt-1 block w-full rounded-md border border-wood/30 bg-cream px-4 py-2.5 text-sm text-forest placeholder:text-muted/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30";
const labelCls = "block text-sm font-medium text-forest";

export function MemberEditModal({
  personId,
  onClose,
  onSaved,
}: {
  personId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<EditForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/admin/anggota?id=${encodeURIComponent(personId)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Gagal memuat data anggota"))))
      .then((data) => {
        if (!active) return;
        setForm({
          fullName: data.fullName ?? "",
          nickname: data.nickname ?? "",
          namaPanggilan: data.namaPanggilan ?? "",
          gender: data.gender ?? "MALE",
          birthPlace: data.birthPlace ?? "",
          birthDate: data.birthDate ? String(data.birthDate).slice(0, 10) : "",
          phone: data.private?.phone ?? "",
          addressLine: data.private?.addressLine ?? "",
          city: data.private?.city ?? "",
        });
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Gagal memuat data anggota");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [personId]);

  function update<K extends keyof EditForm>(field: K, value: EditForm[K]) {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    setError(null);

    if (!form.fullName.trim()) {
      setError("Nama lengkap wajib diisi.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/keluarga/person/${personId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          nickname: form.nickname.trim() || null,
          namaPanggilan: form.namaPanggilan.trim() || null,
          gender: form.gender,
          birthPlace: form.birthPlace.trim() || null,
          birthDate: form.birthDate || null,
          phone: form.phone.trim() || null,
          addressLine: form.addressLine.trim() || null,
          city: form.city.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Gagal menyimpan data anggota");

      toast("success", "Data anggota berhasil diperbarui.");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan data anggota");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Edit Data Anggota"
      description="Perbarui data diri anggota keluarga."
      size="lg"
    >
      {loading && !form ? (
        <p className="py-8 text-center text-sm text-muted">Memuat data anggota...</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="edit-fullName" className={labelCls}>
              Nama Lengkap
            </label>
            <input
              id="edit-fullName"
              required
              value={form?.fullName ?? ""}
              onChange={(event) => update("fullName", event.target.value)}
              className={inputCls}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="edit-namaPanggilan" className={labelCls}>
                Nama panggilan
              </label>
              <input
                id="edit-namaPanggilan"
                value={form?.namaPanggilan ?? ""}
                onChange={(event) => update("namaPanggilan", event.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="edit-nickname" className={labelCls}>
                Nickname (username)
              </label>
              <input
                id="edit-nickname"
                value={form?.nickname ?? ""}
                onChange={(event) => update("nickname", event.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="edit-gender" className={labelCls}>
                Jenis Kelamin
              </label>
              <select
                id="edit-gender"
                value={form?.gender ?? "MALE"}
                onChange={(event) => update("gender", event.target.value)}
                className={inputCls}
              >
                <option value="MALE">Laki-laki</option>
                <option value="FEMALE">Perempuan</option>
                <option value="OTHER">Lainnya</option>
              </select>
            </div>

            <div>
              <label htmlFor="edit-birthDate" className={labelCls}>
                Tanggal Lahir
              </label>
              <input
                id="edit-birthDate"
                type="date"
                value={form?.birthDate ?? ""}
                onChange={(event) => update("birthDate", event.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label htmlFor="edit-birthPlace" className={labelCls}>
              Tempat Lahir
            </label>
            <input
              id="edit-birthPlace"
              value={form?.birthPlace ?? ""}
              onChange={(event) => update("birthPlace", event.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="edit-phone" className={labelCls}>
              Nomor Telepon
            </label>
            <input
              id="edit-phone"
              type="tel"
              value={form?.phone ?? ""}
              onChange={(event) => update("phone", event.target.value)}
              placeholder="081234567890"
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="edit-addressLine" className={labelCls}>
              Alamat Domisili
            </label>
            <textarea
              id="edit-addressLine"
              rows={2}
              value={form?.addressLine ?? ""}
              onChange={(event) => update("addressLine", event.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="edit-city" className={labelCls}>
              Kota Domisili
            </label>
            <input
              id="edit-city"
              value={form?.city ?? ""}
              onChange={(event) => update("city", event.target.value)}
              className={inputCls}
            />
          </div>

          {error && (
            <p role="alert" className="rounded-md bg-wood/10 p-3 text-sm text-wood">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="min-h-11 rounded-md bg-gold px-5 py-2.5 text-sm font-semibold text-forest transition-colors hover:bg-gold-deep disabled:opacity-50"
            >
              {saving ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-md border border-wood/30 px-5 py-2.5 text-sm text-muted transition-colors hover:bg-wood/10"
            >
              Batal
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

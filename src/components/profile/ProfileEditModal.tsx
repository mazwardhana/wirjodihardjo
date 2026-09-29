"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { EducationEditor } from "./EducationEditor";
import { SocialLinksEditor } from "./SocialLinksEditor";
import { buttonClass, controlClass } from "./editor-shared";

export type ProfileDraft = {
  fullName: string; nickname: string; bio: string; occupation: string; status: string;
  phone: string; whatsapp: string; addressLine: string; city: string; visibleToMembers: boolean;
};
export type ProfilePlatform = { id: string; name: string };
const publicFields = [["fullName", "Nama lengkap", 200], ["nickname", "Nama panggilan", 100], ["occupation", "Pekerjaan", 200], ["status", "Status", 500], ["city", "Kota (publik)", 100]] as const;
const privateFields = [["phone", "Telepon", 40], ["whatsapp", "WhatsApp", 40], ["addressLine", "Alamat lengkap", 300]] as const;

export function ProfileEditModal({ open, onClose, initialData, onSave, platforms, onChanged }: {
  open: boolean; onClose: () => void; initialData: ProfileDraft;
  onSave: (data: ProfileDraft) => Promise<void>; platforms: ProfilePlatform[]; onChanged: () => void;
}) {
  const [form, setForm] = useState(initialData);
  const [saving, setSaving] = useState(false);
  const [nestedBusy, setNestedBusy] = useState(false);
  const [error, setError] = useState(false);
  const [section, setSection] = useState<"basic" | "education" | "social">("basic");
  const busy = saving || nestedBusy;
  function close() { if (!busy) onClose(); }
  const field = ([key, label, maxLength]: (typeof publicFields)[number] | (typeof privateFields)[number]) => <label key={key} className="min-w-0 text-sm">{label}
    <input className={controlClass} value={form[key]} required={key === "fullName"} maxLength={maxLength}
      type={key === "phone" || key === "whatsapp" ? "tel" : "text"}
      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
  </label>;

  return <Dialog open={open} onClose={close} title="Edit profil" description="Data publik dan kontak keluarga dikelola terpisah." size="lg">
    <div className="space-y-5 text-forest">
      <div role="group" className="flex flex-wrap gap-2" aria-label="Bagian editor">
        {([["basic", "Info dasar"], ["education", "Pendidikan"], ["social", "Sosial media"]] as const).map(([key, label]) => <button type="button" key={key} disabled={busy} aria-pressed={section === key} className={`${buttonClass} ${section === key ? "bg-gold !text-ink" : ""}`} onClick={() => setSection(key)}>{label}</button>)}
      </div>
      <div hidden={section !== "basic"}>
        <form onSubmit={async e => {
          e.preventDefault(); setSaving(true); setError(false);
          try { await onSave(form); onClose(); } catch { setError(true); } finally { setSaving(false); }
        }}>
          <fieldset disabled={busy} className="min-w-0 space-y-5">
            <legend className="mb-3 font-display text-lg">Data publik</legend>
            <p className="text-sm text-muted">Nama, kota, pekerjaan, status, dan bio dapat dilihat siapa saja.</p>
            <div className="grid gap-4 sm:grid-cols-2">{publicFields.map(field)}</div>
            <label className="block text-sm">Bio singkat<textarea rows={3} className={controlClass} maxLength={2000} value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} /></label>
            <h3 className="border-t border-wood/15 pt-5 font-display text-lg">Kontak keluarga</h3>
            <div className="grid gap-4 sm:grid-cols-2">{privateFields.map(field)}</div>
            <label className="flex min-h-11 items-center gap-3 rounded-md border border-wood/20 p-3 text-sm">
              <input type="checkbox" checked={form.visibleToMembers} className="h-5 w-5 shrink-0 accent-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest" onChange={e => setForm(f => ({ ...f, visibleToMembers: e.target.checked }))} />
              Bagikan kontak dan alamat lengkap kepada anggota keluarga yang login. Kota tetap publik.
            </label>
            {error && <p role="alert">Profil belum tersimpan. Coba lagi.</p>}
            <div className="flex flex-wrap gap-3 border-t border-wood/15 pt-4"><button type="submit" className={`${buttonClass} bg-gold !text-ink`}>{saving ? "Menyimpan..." : "Simpan profil"}</button><button type="button" className={buttonClass} onClick={close}>Batal</button></div>
          </fieldset>
        </form>
      </div>
      {section === "education" && <EducationEditor onChanged={onChanged} onBusy={setNestedBusy} />}
      {section === "social" && <SocialLinksEditor platforms={platforms} onChanged={onChanged} onBusy={setNestedBusy} />}
      {section !== "basic" && <button type="button" disabled={busy} className={buttonClass} onClick={close}>Tutup editor</button>}
      {busy && <p role="status">Perubahan sedang disimpan. Tunggu sebelum menutup editor.</p>}
    </div>
  </Dialog>;
}

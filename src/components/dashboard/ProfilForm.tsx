"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PhotoUploader } from "@/components/ui/PhotoUploader";
import { signOut } from "@/lib/auth-client";
import { ProfileEditModal, type ProfileDraft, type ProfilePlatform } from "@/components/profile/ProfileEditModal";
import { buttonClass } from "@/components/profile/editor-shared";

export function ProfilForm({ initial, platforms }: { initial: ProfileDraft & { photoUrl: string | null }; platforms: ProfilePlatform[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(initial.photoUrl);
  const [saved, setSaved] = useState(false);
  const [current, setCurrent] = useState(initial);
  return <div className="space-y-6">
    <section className="rounded-lg border border-wood/15 bg-cream p-5">
      <h2 className="font-display text-lg font-semibold text-forest">Foto profil</h2>
      <p className="mb-4 text-sm text-muted">Perubahan foto langsung disimpan dan tampil di silsilah.</p>
      <div className="[&_button]:min-h-11 [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-2 [&_button]:focus-visible:outline-forest [&_label]:focus-within:ring-forest motion-reduce:[&_*]:transition-none">
        <PhotoUploader currentPhotoUrl={photoUrl} personName={current.fullName} onPhotoChange={url => { setPhotoUrl(url); router.refresh(); }} />
      </div>
    </section>
    <div className="flex flex-wrap gap-3">
      <button type="button" className={`${buttonClass} bg-gold !text-ink`} onClick={() => { setSaved(false); setOpen(true); }}>Edit profil</button>
      <button type="button" className={buttonClass} onClick={() => signOut({ callbackUrl: "/" })}>Keluar</button>
    </div>
    {saved && <p role="status" className="text-sm text-forest">Profil berhasil disimpan.</p>}
    {open && <ProfileEditModal open initialData={current} platforms={platforms} onClose={() => setOpen(false)} onChanged={() => router.refresh()} onSave={async data => {
      const response = await fetch("/api/profil/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!response.ok) throw new Error("Profile update failed");
      setCurrent({ ...data, photoUrl });
      setSaved(true);
      router.refresh();
    }} />}
  </div>;
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PhotoUploader } from "@/components/ui/PhotoUploader";
import { Avatar } from "@/components/ui/Avatar";
import { buttonClass, controlClass } from "./editor-shared";

export type ProfileFormInitial = {
  fullName: string;
  nickname: string;
  gender: string;
  photoUrl: string | null;
  birthPlace: string;
  birthDate: string;
  birthDatePrecision: string;
  isDeceased: boolean;
  deathPlace: string;
  deathDate: string;
  phone: string;
  whatsapp: string;
  addressLine: string;
  city: string;
  province: string;
  postalCode: string;
  visibleToMembers: boolean;
};

export type SocialLinkInitial = {
  id: string;
  platform: string;
  url: string;
  username: string | null;
};

type RelationPerson = {
  id: string;
  fullName: string;
  nickname: string | null;
  gender: string;
  photoUrl: string | null;
  isDeceased: boolean;
};

type Relations = {
  parents: Array<RelationPerson & { role: string; isStep: boolean; isAdopted: boolean }>;
  ancestors: Array<RelationPerson & { depth: number; label: string; via: string }>;
  siblings: Array<RelationPerson & { relation: string }>;
  children: Array<RelationPerson & { birthDate: string | null; isStep: boolean; isAdopted: boolean }>;
  descendants: Array<RelationPerson & { depth: number; label: string }>;
  partners: Array<RelationPerson & { status: string; orderIndex: number; marriageDate: string | null; marriagePlace: string | null }>;
};

const SOCIAL_PLATFORMS = ["Instagram", "Facebook", "LinkedIn", "TikTok"] as const;
const emptyRelations: Relations = {
  parents: [],
  ancestors: [],
  siblings: [],
  children: [],
  descendants: [],
  partners: [],
};

const MARITAL_STATUSES = ["BELUM MENIKAH", "MENIKAH", "CERAI", "JANDA", "DUDA", "LAINNYA"] as const;

const PARTNER_STATUS_LABEL: Record<string, string> = {
  MARRIED: "Menikah",
  DIVORCED: "Cerai",
  WIDOWED: "Janda atau duda",
  UNKNOWN: "Status belum diketahui",
};

const PARENT_ROLE_LABEL: Record<string, string> = {
  FATHER: "Ayah",
  MOTHER: "Ibu",
  UNKNOWN: "Wali",
};

function socialInputValue(link: SocialLinkInitial | undefined) {
  if (!link) return "";
  return link.username ?? link.url;
}

function PersonChip({ person, note }: { person: RelationPerson; note?: string }) {
  return (
    <span className="flex min-h-11 items-center gap-2 rounded-md border border-wood/15 bg-parchment/40 px-3 py-1.5 text-sm text-forest">
      <Avatar name={person.fullName} photoUrl={person.photoUrl} size="sm" />
      <span className="min-w-0">
        <span className="block truncate font-medium">
          {person.fullName}
          {person.isDeceased ? " (alm.)" : ""}
        </span>
        {note && <span className="block text-xs text-muted">{note}</span>}
      </span>
    </span>
  );
}

function SectionCard({
  step,
  title,
  description,
  children,
}: {
  step: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-wood/15 bg-cream p-5">
      <h2 className="font-display text-lg font-semibold text-forest">
        <span className="mr-2 text-gold-deep">{step}.</span>
        {title}
      </h2>
      <p className="mt-1 text-sm text-muted">{description}</p>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function ProfileForm({
  initial,
  socialLinks,
}: {
  initial: ProfileFormInitial;
  socialLinks: SocialLinkInitial[];
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [photoUrl, setPhotoUrl] = useState(initial.photoUrl);
  const [social, setSocial] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      SOCIAL_PLATFORMS.map((name) => {
        const match = socialLinks.find((link) => link.platform.toLowerCase() === name.toLowerCase());
        return [name, socialInputValue(match)];
      }),
    ),
  );
  const [socialIds] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      SOCIAL_PLATFORMS.map((name) => {
        const match = socialLinks.find((link) => link.platform.toLowerCase() === name.toLowerCase());
        return [name, match?.id ?? ""];
      }),
    ),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const [relations, setRelations] = useState<Relations>(emptyRelations);
  const [relationsLoading, setRelationsLoading] = useState(true);
  const [relationsError, setRelationsError] = useState<string | null>(null);

  const loadRelations = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/profil/relations", { signal });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (!signal?.aborted) {
        setRelations({ ...emptyRelations, ...(data.relations ?? {}) });
        setRelationsError(null);
      }
    } catch {
      if (!signal?.aborted) setRelationsError("Data keluarga belum dapat dimuat. Coba lagi.");
    } finally {
      if (!signal?.aborted) setRelationsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // loadRelations hanya mengubah state setelah permintaan selesai.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRelations(controller.signal);
    return () => controller.abort();
  }, [loadRelations]);

  function set<K extends keyof ProfileFormInitial>(key: K, value: ProfileFormInitial[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice("");
    try {
      const response = await fetch("/api/profil/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          nickname: form.nickname,
          gender: form.gender,
          birthPlace: form.birthPlace,
          birthDate: form.birthDate,
          birthDatePrecision: form.birthDatePrecision || undefined,
          isDeceased: form.isDeceased,
          deathPlace: form.deathPlace,
          deathDate: form.deathDate,
          phone: form.phone,
          whatsapp: form.whatsapp,
          addressLine: form.addressLine,
          city: form.city,
          province: form.province,
          postalCode: form.postalCode,
          visibleToMembers: form.visibleToMembers,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Profil belum tersimpan. Coba lagi.");
      }

      for (const platform of SOCIAL_PLATFORMS) {
        const value = social[platform].trim();
        if (!value) {
          if (socialIds[platform]) {
            await fetch(`/api/profil/social/${encodeURIComponent(socialIds[platform])}`, { method: "DELETE" });
          }
          continue;
        }
        const socialResponse = await fetch("/api/profil/social", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform, url: value, username: value.replace(/^@/, "") }),
        });
        if (!socialResponse.ok) {
          const data = await socialResponse.json().catch(() => ({}));
          throw new Error(data.error ?? `Tautan ${platform} belum tersimpan. Periksa username atau URL.`);
        }
      }

      setNotice("Profil berhasil disimpan.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Profil belum tersimpan. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  async function linkParent(personId: string, role: "FATHER" | "MOTHER") {
    setRelationsError(null);
    const response = await fetch("/api/profil/relations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setParent", personId, role }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setRelationsError(data.error ?? "Orang tua belum tersimpan. Coba lagi.");
      return;
    }
    await loadRelations();
  }

  async function linkPartner(personId: string, maritalStatus: string, marriageDate: string, marriagePlace: string) {
    setRelationsError(null);
    const response = await fetch("/api/profil/relations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setPartner", personId, maritalStatus, marriageDate, marriagePlace }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setRelationsError(data.error ?? "Pasangan belum tersimpan. Coba lagi.");
      return;
    }
    await loadRelations();
  }

  return (
    <form className="space-y-6" onSubmit={saveProfile}>
      <SectionCard step="1" title="Identitas dan Media Sosial" description="Nama, gender, foto, dan tautan sosial media. Username atau URL lengkap sama-sama diterima.">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={form.fullName || "Anggota"} photoUrl={photoUrl} size="lg" />
          <div className="[&_button]:min-h-11 [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-2 [&_button]:focus-visible:outline-forest [&_label]:focus-within:ring-forest motion-reduce:[&_*]:transition-none">
            <PhotoUploader
              currentPhotoUrl={photoUrl}
              personName={form.fullName}
              onPhotoChange={(url) => {
                setPhotoUrl(url);
                router.refresh();
              }}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="min-w-0 text-sm">
            Nama lengkap
            <input className={controlClass} value={form.fullName} required maxLength={200} onChange={(event) => set("fullName", event.target.value)} />
          </label>
          <label className="min-w-0 text-sm">
            Nama panggilan
            <input className={controlClass} value={form.nickname} maxLength={100} onChange={(event) => set("nickname", event.target.value)} />
          </label>
          <label className="min-w-0 text-sm">
            Gender
            <select className={controlClass} value={form.gender} onChange={(event) => set("gender", event.target.value)}>
              <option value="MALE">Laki-laki</option>
              <option value="FEMALE">Perempuan</option>
              <option value="OTHER">Lainnya</option>
            </select>
          </label>
        </div>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-1 text-sm font-medium text-forest">Akun media sosial</legend>
          {SOCIAL_PLATFORMS.map((platform) => (
            <label key={platform} className="min-w-0 text-sm">
              {platform}
              <input
                className={controlClass}
                value={social[platform]}
                placeholder={`Username atau URL ${platform}`}
                maxLength={500}
                onChange={(event) => setSocial((current) => ({ ...current, [platform]: event.target.value }))}
              />
            </label>
          ))}
        </fieldset>
      </SectionCard>

      <SectionCard step="2" title="Kelahiran dan Kematian" description="Data kelahiran dan, bila sudah wafat, tempat serta tanggal wafat.">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="min-w-0 text-sm">
            Tempat lahir
            <input className={controlClass} value={form.birthPlace} maxLength={200} onChange={(event) => set("birthPlace", event.target.value)} />
          </label>
          <label className="min-w-0 text-sm">
            Tanggal lahir
            <input className={controlClass} type="date" value={form.birthDate} onChange={(event) => set("birthDate", event.target.value)} />
          </label>
          <label className="min-w-0 text-sm">
            Ketelitian tanggal lahir
            <select className={controlClass} value={form.birthDatePrecision} onChange={(event) => set("birthDatePrecision", event.target.value)}>
              <option value="">Tidak diketahui</option>
              <option value="DAY">Tanggal lengkap</option>
              <option value="MONTH">Bulan dan tahun</option>
              <option value="YEAR">Tahun saja</option>
            </select>
          </label>
        </div>
        <label className="flex min-h-11 items-center gap-3 rounded-md border border-wood/20 p-3 text-sm">
          <input
            type="checkbox"
            className="h-5 w-5 shrink-0 accent-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
            checked={form.isDeceased}
            onChange={(event) => set("isDeceased", event.target.checked)}
          />
          Sudah wafat
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="min-w-0 text-sm">
            Tempat wafat
            <input className={controlClass} value={form.deathPlace} maxLength={200} onChange={(event) => set("deathPlace", event.target.value)} />
          </label>
          <label className="min-w-0 text-sm">
            Tanggal wafat
            <input className={controlClass} type="date" value={form.deathDate} onChange={(event) => set("deathDate", event.target.value)} />
          </label>
        </div>
      </SectionCard>

      <SectionCard step="3" title="Lokasi dan Tempat Tinggal" description="Alamat lengkap termasuk RT/RW, kota domisili, provinsi, dan kode pos. Data ini hanya dibagikan bila diizinkan.">
        <label className="block min-w-0 text-sm">
          Alamat lengkap (sertakan RT/RW)
          <textarea className={controlClass} rows={3} value={form.addressLine} maxLength={300} onChange={(event) => set("addressLine", event.target.value)} />
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="min-w-0 text-sm">
            Kota domisili
            <input className={controlClass} value={form.city} maxLength={100} onChange={(event) => set("city", event.target.value)} />
          </label>
          <label className="min-w-0 text-sm">
            Provinsi
            <input className={controlClass} value={form.province} maxLength={100} onChange={(event) => set("province", event.target.value)} />
          </label>
          <label className="min-w-0 text-sm">
            Kode pos
            <input className={controlClass} inputMode="numeric" value={form.postalCode} maxLength={20} onChange={(event) => set("postalCode", event.target.value)} />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="min-w-0 text-sm">
            Telepon
            <input className={controlClass} type="tel" value={form.phone} maxLength={40} onChange={(event) => set("phone", event.target.value)} />
          </label>
          <label className="min-w-0 text-sm">
            WhatsApp
            <input className={controlClass} type="tel" value={form.whatsapp} maxLength={40} onChange={(event) => set("whatsapp", event.target.value)} />
          </label>
        </div>
        <label className="flex min-h-11 items-center gap-3 rounded-md border border-wood/20 p-3 text-sm">
          <input
            type="checkbox"
            className="h-5 w-5 shrink-0 accent-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
            checked={form.visibleToMembers}
            onChange={(event) => set("visibleToMembers", event.target.checked)}
          />
          Bagikan kontak dan alamat lengkap kepada anggota keluarga yang login. Kota tetap publik.
        </label>
      </SectionCard>

      <div className="space-y-3">
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="text-sm text-forest">{notice}</p>}
        <button type="submit" disabled={saving} className={`${buttonClass} bg-gold !text-ink`}>
          {saving ? "Menyimpan..." : "Simpan profil"}
        </button>
      </div>

      <SectionCard step="4" title="Hubungan Keluarga" description="Orang tua dan pasangan dipilih dari data keluarga yang sudah ada. Daftar anak dan relasi lain dihitung otomatis dari silsilah.">
        {relationsLoading && <p role="status" className="text-sm text-muted">Memuat data keluarga...</p>}
        {relationsError && (
          <div role="alert" className="space-y-2 text-sm text-red-700">
            <p>{relationsError}</p>
            <button type="button" className={buttonClass} onClick={() => { setRelationsLoading(true); void loadRelations(); }}>
              Coba muat lagi
            </button>
          </div>
        )}

        <ParentPicker parents={relations.parents} onLink={linkParent} />
        <SpousePicker partners={relations.partners} onLink={linkPartner} />

        <div>
          <h3 className="font-display text-base font-semibold text-forest">Anak</h3>
          <p className="mt-1 text-xs text-muted">Diurutkan dari yang paling tua berdasarkan tanggal lahir.</p>
          {relations.children.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Belum ada data anak. Tambah anak lewat menu pengajuan keluarga.</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2">
              {relations.children.map((child) => (
                <li key={child.id}>
                  <PersonChip person={child} note={child.isStep ? "Anak tiri" : child.isAdopted ? "Anak angkat" : undefined} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="font-display text-base font-semibold text-forest">Rantai ke atas</h3>
          {relations.ancestors.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Belum ada data kakek, nenek, atau buyut.</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2">
              {relations.ancestors.map((ancestor) => (
                <li key={ancestor.id}>
                  <PersonChip person={ancestor} note={ancestor.label} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="font-display text-base font-semibold text-forest">Saudara</h3>
          {relations.siblings.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Belum ada data saudara.</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2">
              {relations.siblings.map((sibling) => (
                <li key={sibling.id}>
                  <PersonChip person={sibling} note={sibling.relation} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="font-display text-base font-semibold text-forest">Keturunan</h3>
          {relations.descendants.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Belum ada data cucu atau keturunan lebih lanjut.</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2">
              {relations.descendants.map((descendant) => (
                <li key={descendant.id}>
                  <PersonChip person={descendant} note={descendant.label} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </SectionCard>
    </form>
  );
}

function usePersonSearch(query: string, scope: "branch" | "all") {
  const [candidates, setCandidates] = useState<RelationPerson[]>([]);
  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query.trim() });
        if (scope === "all") params.set("scope", "all");
        const response = await fetch(`/api/profil/relations?${params.toString()}`, { signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json();
        setCandidates(data.candidates ?? []);
      } catch {
        // Pencarian dibatalkan atau gagal; hasil lama dibiarkan.
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, scope]);
  return [candidates, setCandidates] as const;
}

function ParentPicker({
  parents,
  onLink,
}: {
  parents: Relations["parents"];
  onLink: (personId: string, role: "FATHER" | "MOTHER") => Promise<void>;
}) {
  const [role, setRole] = useState<"FATHER" | "MOTHER">("FATHER");
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = usePersonSearch(query, "branch");
  const [busy, setBusy] = useState(false);

  return (
    <div>
      <h3 className="font-display text-base font-semibold text-forest">Orang tua</h3>
      {parents.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Belum ada data orang tua.</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2">
          {parents.map((parent) => (
            <li key={parent.id}>
              <PersonChip person={parent} note={PARENT_ROLE_LABEL[parent.role] ?? "Orang tua"} />
            </li>
          ))}
        </ul>
      )}
      <fieldset className="mt-3 grid gap-3 rounded-md border border-wood/15 p-3 sm:grid-cols-[8rem_1fr_auto]">
        <legend className="px-1 text-xs font-medium uppercase tracking-wide text-muted">Tautkan orang tua</legend>
        <label className="min-w-0 text-sm">
          Peran
          <select className={controlClass} value={role} onChange={(event) => setRole(event.target.value as "FATHER" | "MOTHER")}>
            <option value="FATHER">Ayah</option>
            <option value="MOTHER">Ibu</option>
          </select>
        </label>
        <label className="min-w-0 text-sm">
          Cari nama dari keluarga cabang yang sama
          <input
            className={controlClass}
            value={query}
            placeholder="Tulis minimal 2 huruf"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="flex items-end">
          <span className="text-xs text-muted">Pilih dari hasil pencarian</span>
        </div>
        {query.trim().length >= 2 && candidates.length > 0 && (
          <ul className="sm:col-span-3 flex flex-wrap gap-2">
            {candidates.map((candidate) => (
              <li key={candidate.id}>
                <button
                  type="button"
                  disabled={busy}
                  className={buttonClass}
                  onClick={async () => {
                    setBusy(true);
                    await onLink(candidate.id, role);
                    setBusy(false);
                    setQuery("");
                    setCandidates([]);
                  }}
                >
                  {candidate.fullName}
                </button>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
    </div>
  );
}

function SpousePicker({
  partners,
  onLink,
}: {
  partners: Relations["partners"];
  onLink: (personId: string, maritalStatus: string, marriageDate: string, marriagePlace: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = usePersonSearch(query, "all");
  const [selected, setSelected] = useState<RelationPerson | null>(null);
  const [maritalStatus, setMaritalStatus] = useState("MENIKAH");
  const [marriageDate, setMarriageDate] = useState("");
  const [marriagePlace, setMarriagePlace] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div>
      <h3 className="font-display text-base font-semibold text-forest">Pasangan</h3>
      {partners.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Belum ada data pasangan.</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2">
          {partners.map((partner) => (
            <li key={partner.id}>
              <PersonChip
                person={partner}
                note={[PARTNER_STATUS_LABEL[partner.status] ?? "Pasangan", partner.marriagePlace].filter(Boolean).join(", ")}
              />
            </li>
          ))}
        </ul>
      )}
      <fieldset className="mt-3 grid gap-3 rounded-md border border-wood/15 p-3 sm:grid-cols-2">
        <legend className="px-1 text-xs font-medium uppercase tracking-wide text-muted">Tautkan pasangan</legend>
        <label className="min-w-0 text-sm">
          Status pernikahan
          <select className={controlClass} value={maritalStatus} onChange={(event) => setMaritalStatus(event.target.value)}>
            {MARITAL_STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>
        <label className="min-w-0 text-sm">
          Cari nama pasangan
          <input className={controlClass} value={query} placeholder="Tulis minimal 2 huruf" onChange={(event) => setQuery(event.target.value)} />
        </label>
        <label className="min-w-0 text-sm">
          Tanggal pernikahan
          <input className={controlClass} type="date" value={marriageDate} onChange={(event) => setMarriageDate(event.target.value)} />
        </label>
        <label className="min-w-0 text-sm">
          Tempat pernikahan
          <input className={controlClass} value={marriagePlace} maxLength={300} onChange={(event) => setMarriagePlace(event.target.value)} />
        </label>
        {selected && (
          <p className="sm:col-span-2 text-sm text-forest">
            Pasangan dipilih: <span className="font-medium">{selected.fullName}</span>
          </p>
        )}
        {query.trim().length >= 2 && candidates.length > 0 && (
          <ul className="sm:col-span-2 flex flex-wrap gap-2">
            {candidates.map((candidate) => (
              <li key={candidate.id}>
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() => {
                    setSelected(candidate);
                    setQuery(candidate.fullName);
                    setCandidates([]);
                  }}
                >
                  {candidate.fullName}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="sm:col-span-2">
          <button
            type="button"
            disabled={busy || !selected}
            className={`${buttonClass} bg-gold !text-ink`}
            onClick={async () => {
              if (!selected) return;
              setBusy(true);
              await onLink(selected.id, maritalStatus, marriageDate, marriagePlace);
              setBusy(false);
              setSelected(null);
              setQuery("");
            }}
          >
            {busy ? "Menyimpan..." : "Simpan pasangan"}
          </button>
        </div>
      </fieldset>
    </div>
  );
}

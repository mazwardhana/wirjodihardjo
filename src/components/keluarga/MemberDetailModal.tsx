"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { calculateAge, normalizeWhatsApp } from "@/lib/profile";

export type MemberDetailModalProps = {
  personId: string;
  onClose: () => void;
};

type TreeMember = {
  id: string;
  fullName: string;
  nickname: string | null;
  photoUrl: string | null;
  gender: string;
  generationLevel: number | null;
  isDeceased: boolean;
};

type AncestorLevel = {
  level: number;
  label: string;
  members: (TreeMember & { label: string })[];
};

type DescendantLevel = { level: number; label: string; members: TreeMember[] };

type SiblingSection = {
  type: string;
  label: string;
  description: string;
  members: TreeMember[];
};

type ParentEntry = TreeMember & { role: string; isStep: boolean; isAdopted: boolean };
type ChildEntry = TreeMember & { isStep: boolean; isAdopted: boolean };

type PrivateContact = {
  visibleToMembers: boolean;
  city: string | null;
  province: string | null;
  addressLine: string | null;
  postalCode: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  maritalStatus: string | null;
};

type EducationRow = {
  id: string;
  institution: string;
  degree: string | null;
  fieldOfStudy: string | null;
  startYear: number | null;
  endYear: number | null;
};

type SocialLinkRow = {
  id: string;
  url: string;
  username: string | null;
  platform: { name: string } | null;
};

type PersonProfile = TreeMember & {
  birthDate: string | null;
  birthPlace: string | null;
  deathDate: string | null;
  deathPlace: string | null;
  occupation: string | null;
  status: string | null;
  bio: string | null;
  isMarriedInto: boolean;
  education: EducationRow[];
  socialLinks: SocialLinkRow[];
  private: PrivateContact | null;
};

type RelasiPayload = {
  person: PersonProfile;
  branch: { id: string; name: string; branchNumber: number } | null;
  ancestors: AncestorLevel[];
  siblings: SiblingSection[];
  descendants: DescendantLevel[];
  parents: ParentEntry[];
  children: ChildEntry[];
};

const cardCls = "rounded-lg border border-wood/20 bg-parchment/30 p-4";
const sectionTitleCls = "font-display text-base font-semibold text-forest";
const rowCls =
  "flex items-start justify-between gap-4 border-b border-wood/10 py-2 last:border-b-0";
const dtCls = "text-sm text-muted";
const ddCls = "text-right text-sm font-medium text-forest";

function genderText(gender: string): string {
  if (gender === "MALE") return "Laki-laki";
  if (gender === "FEMALE") return "Perempuan";
  return "Lainnya";
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function ageText(person: PersonProfile): string {
  const birth = person.birthDate ? new Date(person.birthDate) : null;
  if (!birth || Number.isNaN(birth.getTime())) return "-";

  if (person.isDeceased && person.deathDate) {
    const death = new Date(person.deathDate);
    if (!Number.isNaN(death.getTime())) {
      const age = calculateAge(birth, death);
      return age === null ? "-" : `${age} tahun (saat wafat)`;
    }
  }

  const age = calculateAge(birth);
  return age === null ? "-" : `${age} tahun`;
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={rowCls}>
      <dt className={dtCls}>{label}</dt>
      <dd className={ddCls}>{children}</dd>
    </div>
  );
}

function MemberList({ members }: { members: TreeMember[] }) {
  if (members.length === 0) {
    return <p className="text-sm text-muted">(Kosong)</p>;
  }
  return (
    <ul className="space-y-1">
      {members.map((member) => (
        <li key={member.id} className="text-sm text-forest">
          <span className="font-medium">{member.fullName}</span>
          {member.nickname ? <span className="text-muted"> ({member.nickname})</span> : null}
        </li>
      ))}
    </ul>
  );
}

export function MemberDetailModal({ personId, onClose }: MemberDetailModalProps) {
  const [data, setData] = useState<RelasiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/admin/keluarga/relasi?personId=${encodeURIComponent(personId)}`,
          { signal },
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Gagal memuat detail anggota");
        }
        setData((await res.json()) as RelasiPayload);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Gagal memuat detail anggota");
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [personId, reloadKey]);

  const person = data?.person;
  const contact = person?.private ?? null;
  const showAddress = contact?.visibleToMembers === true;
  const waNumber = contact?.whatsapp ? normalizeWhatsApp(contact.whatsapp) : null;
  const ancestorRows = [...(data?.ancestors ?? [])].reverse();

  return (
    <Dialog
      open
      onClose={onClose}
      title={person?.fullName ?? "Detail Anggota"}
      description="Profil lengkap dan hubungan keluarga anggota."
      size="lg"
    >
      {loading && !data ? (
        <div role="status" className="py-10 text-center text-sm text-muted">
          Memuat detail anggota...
        </div>
      ) : error ? (
        <div role="alert" className="rounded-md bg-wood/10 p-4 text-sm text-wood">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="mt-3 min-h-11 rounded-md border border-wood/40 px-4 py-2 text-sm font-semibold text-forest transition-colors hover:bg-cream"
          >
            Coba lagi
          </button>
        </div>
      ) : person ? (
        <div className="space-y-6">
          {/* Profil lengkap */}
          <section>
            <h3 className={sectionTitleCls}>Profil</h3>
            <dl className={`mt-3 ${cardCls}`}>
              <InfoRow label="Nama lengkap">{person.fullName}</InfoRow>
              <InfoRow label="Nama panggilan">{person.nickname || "-"}</InfoRow>
              <InfoRow label="Jenis kelamin">{genderText(person.gender)}</InfoRow>
              <InfoRow label="Usia">{ageText(person)}</InfoRow>
              <InfoRow label="Tempat lahir">{person.birthPlace || "-"}</InfoRow>
              <InfoRow label="Tanggal lahir">{formatDate(person.birthDate) ?? "-"}</InfoRow>
              <InfoRow label="Status">
                <span className={person.isDeceased ? "text-wood" : "text-forest"}>
                  {person.isDeceased ? "Wafat" : "Hidup"}
                </span>
              </InfoRow>
              {person.isDeceased && (
                <>
                  <InfoRow label="Tanggal wafat">{formatDate(person.deathDate) ?? "-"}</InfoRow>
                  <InfoRow label="Tempat wafat">
                    {(person as PersonProfile & { deathPlace?: string | null }).deathPlace || "-"}
                  </InfoRow>
                </>
              )}
              <InfoRow label="Kota domisili">
                {showAddress ? contact?.city || "-" : "Disembunyikan oleh pemilik data"}
              </InfoRow>
              <InfoRow label="Alamat">
                {showAddress
                  ? [contact?.addressLine, contact?.province, contact?.postalCode]
                      .filter(Boolean)
                      .join(", ") || "-"
                  : "Disembunyikan oleh pemilik data"}
              </InfoRow>
              <InfoRow label="Pekerjaan">{person.occupation || "-"}</InfoRow>
              <InfoRow label="Cabang">
                {data.branch ? `${data.branch.name} (nomor ${data.branch.branchNumber})` : "-"}
              </InfoRow>
              <InfoRow label="Generasi">
                {person.generationLevel === null ? "Belum ditetapkan" : `Generasi ${person.generationLevel}`}
              </InfoRow>
            </dl>
          </section>

          {person.bio && (
            <section>
              <h3 className={sectionTitleCls}>Bio</h3>
              <p className="mt-3 whitespace-pre-line rounded-lg border border-wood/20 bg-parchment/30 p-4 text-sm text-forest/90">
                {person.bio}
              </p>
            </section>
          )}

          {/* Kontak */}
          <section>
            <h3 className={sectionTitleCls}>Kontak</h3>
            <dl className={`mt-3 ${cardCls}`}>
              <InfoRow label="Telepon">{contact?.phone || "-"}</InfoRow>
              <InfoRow label="WhatsApp">
                {waNumber ? (
                  <a
                    href={`https://wa.me/${waNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-gold-deep"
                  >
                    {contact?.whatsapp}
                  </a>
                ) : (
                  contact?.whatsapp || "-"
                )}
              </InfoRow>
              <InfoRow label="Email">{contact?.email || "-"}</InfoRow>
            </dl>
          </section>

          {/* Pendidikan */}
          <section>
            <h3 className={sectionTitleCls}>Pendidikan</h3>
            {person.education.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Belum ada data pendidikan.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {person.education.map((edu) => (
                  <li key={edu.id} className={cardCls}>
                    <p className="text-sm font-medium text-forest">{edu.institution}</p>
                    <p className="text-sm text-muted">
                      {[edu.degree, edu.fieldOfStudy].filter(Boolean).join(" - ") || "-"}
                      {edu.startYear || edu.endYear
                        ? ` (${edu.startYear ?? "?"} - ${edu.endYear ?? "sekarang"})`
                        : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Media sosial */}
          <section>
            <h3 className={sectionTitleCls}>Media sosial</h3>
            {person.socialLinks.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Belum ada data media sosial.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {person.socialLinks.map((link) => (
                  <li key={link.id} className={cardCls}>
                    <p className="text-sm font-medium text-forest">
                      {link.platform?.name ?? "Tautan"}
                    </p>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-sm text-gold-deep underline hover:text-forest"
                    >
                      {link.username || link.url}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Hubungan keluarga (read-only) */}
          <section>
            <h3 className={sectionTitleCls}>Generasi ke atas</h3>
            <div className="mt-3 overflow-x-auto rounded-md border border-wood/15">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead>
                  <tr className="border-b border-wood/15 bg-parchment/40 text-xs font-medium uppercase tracking-wide text-muted">
                    <th scope="col" className="px-4 py-3">Tingkat</th>
                    <th scope="col" className="px-4 py-3">Nama</th>
                  </tr>
                </thead>
                <tbody>
                  {ancestorRows.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-4 py-6 text-center text-muted">
                        Belum ada data generasi ke atas.
                      </td>
                    </tr>
                  ) : (
                    ancestorRows.map((level) => (
                      <tr key={level.level} className="border-b border-wood/10 last:border-b-0">
                        <td className="px-4 py-3 align-top font-medium text-forest">{level.label}</td>
                        <td className="px-4 py-3 align-top">
                          {level.members.length === 0 ? (
                            <span className="text-muted">(Kosong)</span>
                          ) : (
                            <ul className="space-y-1">
                              {level.members.map((member) => (
                                <li key={member.id} className="text-forest">
                                  <span className="font-medium">{member.label}</span>
                                  <span className="text-muted">: </span>
                                  {member.fullName}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 className={sectionTitleCls}>Informasi saudara</h3>
            {data.siblings.length === 0 ? (
              <div className={`mt-3 ${cardCls}`}>
                <p className="text-sm text-muted">Belum ada data saudara.</p>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {data.siblings.map((section) => (
                  <div key={section.type} className={cardCls}>
                    <p className="font-display text-sm font-semibold text-gold-deep">{section.label}</p>
                    <p className="mt-1 text-sm text-muted">{section.description}</p>
                    <div className="mt-2">
                      <MemberList members={section.members} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className={sectionTitleCls}>Informasi generasi di bawahnya</h3>
            <div className="mt-3 divide-y divide-wood/10 rounded-md border border-wood/15">
              {data.descendants.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted">Belum ada data keturunan.</p>
              ) : (
                data.descendants.map((level) => (
                  <div key={level.level} className="px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-medium text-forest">{level.label}</p>
                      <p className="text-xs text-muted">Tingkat {level.level}</p>
                    </div>
                    <div className="mt-1">
                      <MemberList members={level.members} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      ) : null}
    </Dialog>
  );
}

import { Avatar } from "@/components/ui/Avatar";
import { getGenerationLabel } from "@/lib/generations";
import { normalizeWhatsApp, type PublicProfile, type MemberProfile } from "@/lib/profile";

type Contacts = Pick<MemberProfile, "phone" | "whatsapp" | "email" | "addressLine">;
const linkClass = "inline-flex min-h-11 items-center break-all text-forest underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest";

export function ProfileCard({ profile, contacts, isMember = false }: {
  profile: PublicProfile;
  contacts?: Contacts | null;
  isMember?: boolean;
}) {
  const whatsapp = contacts?.whatsapp ? normalizeWhatsApp(contacts.whatsapp) : null;
  const details = [
    ["Jenis kelamin", { MALE: "Laki-laki", FEMALE: "Perempuan", OTHER: "Lainnya" }[profile.gender]],
    ["Usia", profile.age === null ? null : `${profile.age} tahun`],
    ["Kota", profile.city], ["Pekerjaan", profile.occupation], ["Status", profile.status],
  ];
  return (
    <article className="space-y-8 break-words text-forest">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <Avatar name={profile.fullName} photoUrl={profile.photoUrl} size="xl" className="shrink-0" />
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-semibold">{profile.fullName}</h1>
          <p className="mt-1 text-muted">{profile.nickname || "Nama panggilan belum diisi"}</p>
          <p className="mt-3 font-medium text-wood">{getGenerationLabel(profile.generationLevel)}</p>
          <p className="text-sm text-muted">{profile.branch ? `Keluarga Cabang ${profile.branch.name}` : "Keluarga Cabang belum tercatat"}</p>
          <p className="text-sm text-muted">{profile.isDeceased ? "Almarhum/Almarhumah" : "Masih hidup"}</p>
        </div>
      </header>
      <dl className="grid gap-x-6 gap-y-4 border-y border-wood/15 py-5 sm:grid-cols-2">
        {details.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-sm text-muted">{label}</dt><dd className="mt-1">{value || "Belum diisi"}</dd></div>)}
      </dl>
      <section><h2 className="font-display text-xl font-semibold">Tentang</h2><p className="mt-2 whitespace-pre-wrap leading-relaxed text-muted">{profile.bio || "Bio belum diisi."}</p></section>
      <section>
        <h2 className="font-display text-xl font-semibold">Pendidikan</h2>
        {profile.education.length ? <ul className="mt-3 space-y-4">{profile.education.map(item => <li key={item.id}>
          <p className="font-medium">{item.institution}</p>
          <p className="text-sm text-muted">{[item.degree, item.fieldOfStudy].filter(Boolean).join(" · ")}</p>
          {(item.startYear || item.endYear) && <p className="text-sm text-muted">{item.startYear ?? "Tahun mulai belum diisi"} / {item.endYear ?? "Tahun selesai belum diisi"}</p>}
        </li>)}</ul> : <p className="mt-2 text-sm text-muted">Belum ada data pendidikan.</p>}
      </section>
      <section>
        <h2 className="font-display text-xl font-semibold">Sosial media</h2>
        {profile.socialLinks.length ? <ul>{profile.socialLinks.map(link => <li key={link.id}><a className={linkClass} href={link.url} target="_blank" rel="noopener noreferrer">{link.platform.name}{link.username ? `: ${link.username}` : ""}<span className="sr-only"> (tab baru)</span></a></li>)}</ul> : <p className="mt-2 text-sm text-muted">Belum ada tautan publik.</p>}
      </section>
      <section className="rounded-lg border border-wood/15 bg-cream p-5">
        <h2 className="font-display text-xl font-semibold">Informasi kontak</h2>
        {contacts ? <dl className="mt-3 space-y-3">
          {contacts.addressLine && <div><dt className="text-sm text-muted">Alamat</dt><dd>{contacts.addressLine}</dd></div>}
          {contacts.phone && <div><dt className="text-sm text-muted">Telepon</dt><dd>{contacts.phone}</dd></div>}
          {contacts.whatsapp && <div><dt className="text-sm text-muted">WhatsApp</dt><dd>{whatsapp ? <a className={linkClass} href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer">{contacts.whatsapp}<span className="sr-only"> (tab baru)</span></a> : contacts.whatsapp}</dd></div>}
          {contacts.email && <div><dt className="text-sm text-muted">Email</dt><dd><a className={linkClass} href={`mailto:${contacts.email}`}>{contacts.email}</a></dd></div>}
          {!Object.values(contacts).some(Boolean) && <div><dt className="sr-only">Ketersediaan</dt><dd>Belum ada data kontak.</dd></div>}
        </dl> : <p className="mt-3 text-sm text-muted">{isMember ? "Anggota ini tidak membagikan data kontak." : "Masuk sebagai anggota untuk melihat kontak yang dibagikan."}</p>}
      </section>
    </article>
  );
}

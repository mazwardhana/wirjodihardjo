import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { getGenerationLabel } from "@/lib/generations";
import { formatDate } from "@/lib/utils";
import type {
  FamilyMember,
  ImmediateFamily,
  SiblingGroup,
} from "@/lib/genealogy";

type BranchRef = { id: string; name: string } | null;

type DashboardPerson = {
  id: string;
  fullName: string;
  nickname: string | null;
  photoUrl: string | null;
  generationLevel: number | null;
  isDeceased: boolean;
  branch: BranchRef;
};

type DataKeluargaSayaProps = {
  person: DashboardPerson | null;
  family: ImmediateFamily | null;
  siblings: SiblingGroup[];
};

const PARENT_ROLE_LABEL: Record<string, string> = {
  FATHER: "Ayah",
  MOTHER: "Ibu",
  UNKNOWN: "Wali",
};

const PARTNER_STATUS_LABEL: Record<string, string> = {
  MARRIED: "Menikah",
  DIVORCED: "Cerai",
  WIDOWED: "Janda / Duda",
  UNKNOWN: "Belum diketahui",
};

const linkClass =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-wood/30 bg-cream px-4 py-2 text-center text-sm font-medium text-forest hover:border-gold/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest";
const linkAccentClass =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-wood/30 bg-gold px-4 py-2 text-center text-sm font-semibold text-forest hover:bg-gold-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest";

const chipClass =
  "inline-flex min-h-11 items-center gap-2 rounded-md border border-wood/15 bg-cream px-3 py-1.5 text-sm text-forest hover:border-gold/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest";

function MemberChip({ member, note }: { member: FamilyMember; note?: string }) {
  const hint = member.isDeceased ? "alm." : note;
  return (
    <Link href={`/profil/${member.id}`} className={chipClass}>
      <Avatar name={member.fullName} photoUrl={member.photoUrl} size="sm" />
      <span className="min-w-0">
        <span className="block truncate font-medium">{member.fullName}</span>
        {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
      </span>
    </Link>
  );
}

function FamilyGroup({
  heading,
  description,
  members,
}: {
  heading: string;
  description?: string;
  members: Array<{ member: FamilyMember; note?: string }>;
}) {
  if (members.length === 0) return null;
  return (
    <div>
      <h3
        className="text-xs font-medium uppercase tracking-wide text-muted"
        title={description}
      >
        {heading}
      </h3>
      <div className="mt-1.5 flex flex-wrap gap-3">
        {members.map((item) => (
          <MemberChip
            key={item.member.id}
            member={item.member}
            note={item.note}
          />
        ))}
      </div>
    </div>
  );
}

function FamilyCallout({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-wood/30 bg-parchment/40 px-4 py-5 text-center">
      <p className="font-medium text-forest">{title}</p>
      <p className="mt-1 text-sm text-muted">{description}</p>
      <div className="mt-3 flex justify-center">
        <Link href={actionHref} className={linkClass}>
          {actionLabel}
        </Link>
      </div>
    </div>
  );
}

function BranchBlock({ branch, genLabel }: { branch: BranchRef; genLabel: string }) {
  if (branch) {
    return (
      <div className="mt-4 rounded-lg border border-wood/20 bg-cream p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Keluarga Cabang
            </p>
            <p className="mt-1 font-display text-lg font-semibold text-forest">
              {branch.name}
            </p>
            <p className="text-sm text-muted">{genLabel}</p>
          </div>
          <Link href={`/silsilah?branchId=${branch.id}`} className={linkAccentClass}>
            Lihat pohon keluarga cabang ini
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="mt-4 rounded-lg border border-gold/40 bg-gold/10 px-4 py-4">
      <p className="font-medium text-forest">Keluarga Cabang belum ditetapkan</p>
      <p className="text-sm text-muted">
        Penetapan keluarga cabang dilakukan oleh admin. Lengkapi profil Anda, atau
        jelajahi seluruh silsilah keluarga.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <Link href="/dashboard/profil" className={linkClass}>
          Lengkapi profil
        </Link>
        <Link href="/silsilah" className={linkClass}>
          Jelajahi seluruh silsilah
        </Link>
      </div>
    </div>
  );
}

/**
 * Bagian "Data Keluarga Saya" di halaman dashboard.
 * Data keluarga diambil lewat helper `getImmediateFamily` dan
 * `getClassifiedSiblings` (lihat src/lib/genealogy.ts); panel ini hanya
 * merender hasilnya. Hanya menampilkan data publik (nama, foto, generasi,
 * keluarga cabang, bio) tanpa menyentuh data kontak privat.
 */
export function DataKeluargaSaya({ person, family, siblings }: DataKeluargaSayaProps) {
  if (!person) {
    return (
      <section aria-labelledby="data-keluarga-title" className="mt-10 border-t border-wood/15 pt-6">
        <h2 id="data-keluarga-title" className="font-display text-xl font-semibold text-forest">
          Data Keluarga Saya
        </h2>
        <div className="mt-4">
          <EmptyState
            title="Data keluarga belum tersambung"
            description="Akun Anda belum terhubung dengan data anggota keluarga. Selesaikan proses onboarding atau daftarkan diri sebagai anggota keluarga agar data Anda muncul di silsilah."
            action={
              <Link href="/onboarding" className={linkAccentClass}>
                Lengkapi profil
              </Link>
            }
          />
        </div>
      </section>
    );
  }

  const branch = person.branch;
  const genLabel = getGenerationLabel(person.generationLevel);
  const parents = family?.parents ?? [];
  const grandparents = family?.grandparents ?? [];
  const partners = family?.partners ?? [];
  const children = family?.children ?? [];
  const totalRelations =
    parents.length + partners.length + children.length + siblings.length;

  return (
    <section aria-labelledby="data-keluarga-title" className="mt-10 border-t border-wood/15 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="data-keluarga-title" className="font-display text-xl font-semibold text-forest">
            Data Keluarga Saya
          </h2>
          <p className="text-sm text-muted">
            {branch ? `Keluarga Cabang ${branch.name}` : "Keluarga Cabang belum ditetapkan"} · {genLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={`/profil/${person.id}`} className={linkClass}>
            Lihat profil lengkap
          </Link>
          <Link href={branch ? `/silsilah?branchId=${branch.id}` : "/silsilah"} className={linkClass}>
            {branch ? "Jelajahi silsilah keluarga cabang saya" : "Jelajahi silsilah"}
          </Link>
        </div>
      </div>

      <BranchBlock branch={branch} genLabel={genLabel} />

      {totalRelations === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Belum ada data keluarga tercatat"
            description="Anda belum memiliki catatan orang tua, pasangan, anak, atau saudara di silsilah. Mulai dengan menautkan relasi dari profil atau ajukan anggota baru."
            action={
              <div className="flex flex-wrap justify-center gap-3">
                <Link href="/dashboard/profil" className={linkAccentClass}>
                  Tautkan relasi di profil
                </Link>
                <Link href="/dashboard/pengajuan/baru" className={linkClass}>
                  Ajukan anggota baru
                </Link>
              </div>
            }
          />
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          {parents.length === 0 ? (
            <FamilyCallout
              title="Data orang tua belum tercatat"
              description="Tautkan orang tua dari halaman profil agar posisi Anda di silsilah lengkap."
              actionLabel="Tautkan orang tua"
              actionHref="/dashboard/profil"
            />
          ) : (
            <FamilyGroup
              heading="Orang tua"
              members={parents.map((parent) => ({
                member: parent.member,
                note: [
                  PARENT_ROLE_LABEL[parent.role] ?? "Wali",
                  parent.isStep ? "tiri" : null,
                  parent.isAdopted ? "angkat" : null,
                ]
                  .filter(Boolean)
                  .join(", "),
              }))}
            />
          )}

          <FamilyGroup
            heading="Kakek - Nenek"
            members={grandparents.map((item) => ({
              member: item.member,
              note: PARENT_ROLE_LABEL[item.role] ?? "Wali",
            }))}
          />

          <FamilyGroup
            heading="Pasangan"
            members={partners.map((item) => ({
              member: item.member,
              note: [
                PARTNER_STATUS_LABEL[item.status] ?? "",
                partners.length > 1 ? `ke-${item.orderIndex + 1}` : null,
                item.marriageDate ? formatDate(item.marriageDate) : null,
              ]
                .filter(Boolean)
                .join(" · "),
            }))}
          />

          <FamilyGroup
            heading="Anak"
            members={children.map((item) => ({
              member: item.member,
              note: [item.isStep ? "tiri" : null, item.isAdopted ? "angkat" : null]
                .filter(Boolean)
                .join(", "),
            }))}
          />

          {siblings.map((group) => (
            <FamilyGroup
              key={group.type}
              heading={group.label}
              description={group.description}
              members={group.members.map((member) => ({ member }))}
            />
          ))}
        </div>
      )}
    </section>
  );
}

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getGenerationLabel } from "@/lib/generations";
import { Avatar } from "@/components/ui/Avatar";
import { auth } from "@/lib/auth";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const person = await prisma.person.findUnique({
    where: { id },
    select: { fullName: true },
  });
  if (!person) return { title: "Anggota tidak ditemukan" };
  return { title: person.fullName };
}

export default async function ProfilPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const person = await prisma.person.findUnique({
    where: { id },
    include: {
      branch: { select: { name: true, slug: true } },
      user: { select: { id: true, email: true, role: true } },
    },
  });
  if (!person) notFound();

  // Data privat hanya untuk yang login
  let privateData: {
    addressLine: string | null;
    city: string | null;
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
  } | null = null;

  if (session?.user) {
    const priv = await prisma.personPrivate.findUnique({
      where: { personId: id },
    });
    if (priv && priv.visibleToMembers) {
      privateData = {
        addressLine: priv.addressLine,
        city: priv.city,
        phone: priv.phone,
        whatsapp: priv.whatsapp,
        email: priv.email,
      };
    }
  }

  // Konteks keluarga
  const [parents, children] = await Promise.all([
    prisma.personChild.findMany({
      where: { childId: id },
      include: {
        parent: { select: { id: true, fullName: true } },
      },
    }),
    prisma.personChild.findMany({
      where: { parentId: id },
      include: {
        child: { select: { id: true, fullName: true, gender: true, generationLevel: true } },
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex items-start gap-6">
        <Avatar name={person.fullName} photoUrl={person.photoUrl} size="xl" />
        <div>
          <h1 className="font-display text-3xl font-semibold text-forest">
            {person.fullName}
          </h1>
          {person.nickname && (
            <p className="text-sm text-muted">{person.nickname}</p>
          )}
          <p className="mt-1 text-sm font-medium text-wood">
            {getGenerationLabel(person.generationLevel)}
          </p>
          {person.branch && (
            <p className="text-sm text-muted">
              Cabang: {person.branch.name}
            </p>
          )}
          <p className="text-sm text-muted">
            {person.isDeceased ? "Almarhum/Almarhumah" : "Masih hidup"}
          </p>
        </div>
      </div>

      {person.bio && (
        <div className="mt-8 rounded-lg border border-wood/15 bg-cream p-5">
          <h2 className="font-display text-lg font-semibold text-forest">
            Bio
          </h2>
          <p className="mt-2 leading-relaxed text-muted">{person.bio}</p>
        </div>
      )}

      {/* Data privat — tali akses berlapis */}
      <div className="mt-8 rounded-lg border border-wood/15 bg-cream p-5">
        <h2 className="font-display text-lg font-semibold text-forest">
          Informasi Kontak
        </h2>
        {privateData ? (
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {privateData.addressLine && (
              <>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                  Alamat
                </dt>
                <dd className="text-sm text-forest">
                  {privateData.addressLine}
                  {privateData.city && `, ${privateData.city}`}
                </dd>
              </>
            )}
            {privateData.phone && (
              <>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                  Telepon
                </dt>
                <dd className="text-sm text-forest">{privateData.phone}</dd>
              </>
            )}
            {privateData.whatsapp && (
              <>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                  WhatsApp
                </dt>
                <dd className="text-sm text-forest">
                  <a
                    href={`https://wa.me/${privateData.whatsapp.replace(/[^0-9]/g, "")}`}
                    className="text-gold-deep underline hover:text-forest"
                  >
                    {privateData.whatsapp}
                  </a>
                </dd>
              </>
            )}
            {privateData.email && (
              <>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                  Email
                </dt>
                <dd className="text-sm text-forest">{privateData.email}</dd>
              </>
            )}
          </dl>
        ) : (
          <p className="mt-3 text-sm text-muted">
            {session?.user
              ? "Anggota ini memilih menyembunyikan data kontaknya."
              : "Masuk sebagai anggota untuk melihat data kontak."}
          </p>
        )}
      </div>

      {/* Konteks keluarga */}
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {parents.length > 0 && (
          <div className="rounded-lg border border-wood/15 bg-cream p-5">
            <h2 className="font-display text-lg font-semibold text-forest">
              Orang Tua
            </h2>
            <ul className="mt-3 space-y-2">
              {parents.map((p) => (
                <li key={p.id} className="text-sm">
                  <a
                    href={`/profil/${p.parent.id}`}
                    className="text-forest underline hover:text-gold-deep"
                  >
                    {p.parent.fullName}
                  </a>
                  <span className="ml-1 text-xs text-muted">
                    ({p.parentRole === "MOTHER" ? "Ibu" : p.parentRole === "FATHER" ? "Ayah" : "Wali"})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {children.length > 0 && (
          <div className="rounded-lg border border-wood/15 bg-cream p-5">
            <h2 className="font-display text-lg font-semibold text-forest">
              Anak
            </h2>
            <ul className="mt-3 space-y-2">
              {children.map((c) => (
                <li key={c.id} className="text-sm">
                  <a
                    href={`/profil/${c.child.id}`}
                    className="text-forest underline hover:text-gold-deep"
                  >
                    {c.child.fullName}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
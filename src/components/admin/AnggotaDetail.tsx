"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/ui/Toast";

type Member = {
  id: string;
  fullName: string;
  nickname?: string | null;
  photoUrl?: string | null;
  gender?: string;
  generationLevel?: number | null;
};

export type PersonDetail = {
  id: string;
  fullName: string;
  nickname: string | null;
  gender: string;
  birthDate: string | null;
  birthPlace: string | null;
  isDeceased: boolean;
  deathDate: string | null;
  bio: string | null;
  photoUrl: string | null;
  generationLevel: number | null;
  deletedAt: string | null;
  branch: { id: string; name: string } | null;
  private: { phone: string | null; whatsapp: string | null; addressLine: string | null; city: string | null; email: string | null } | null;
  user: { id: string; email: string; role: string } | null;
  parents: Array<{ id: string; parentRole: string; isStep: boolean; isAdopted: boolean; parent: Member }>;
  children: Array<{ id: string; isStep: boolean; isAdopted: boolean; child: Member }>;
  partnershipsA: Array<{ id: string; status: string; orderIndex: number; partnerB: Member }>;
  partnershipsB: Array<{ id: string; status: string; orderIndex: number; partnerA: Member }>;
  adminNotes: Array<{ id: string; body: string; createdAt: string; author: { person: { fullName: string } } }>;
};

const inputCls =
  "mt-1 block w-full rounded-md border border-wood/30 bg-cream px-4 py-2.5 text-sm text-forest placeholder:text-muted/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30";
const labelCls = "block text-sm font-medium text-forest";

/**
 * Halaman kelola anggota: data publik, data privat, relasi, dan catatan admin.
 * Relasi (orang tua/anak/pasangan) dibaca dari DB; mengubah relasi lewat API
 * /api/admin/relasi agar bisa diaudit dan memicu rekalkulasi generasi.
 */
export function AdminAnggotaDetail({
  person,
  branches,
  isSuperAdmin,
}: {
  person: PersonDetail;
  branches: { id: string; name: string }[];
  isSuperAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const partners = [
    ...person.partnershipsA.map((p) => ({ edgeId: p.id, member: p.partnerB, status: p.status, orderIndex: p.orderIndex })),
    ...person.partnershipsB.map((p) => ({ edgeId: p.id, member: p.partnerA, status: p.status, orderIndex: p.orderIndex })),
  ].sort((a, b) => a.orderIndex - b.orderIndex);

  async function softDelete() {
    try {
      const res = await fetch(`/api/admin/anggota?id=${person.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? "Gagal menghapus");
      }
      toast("success", "Anggota dipindahkan ke arsip (soft delete).");
      setConfirmDelete(false);
      router.push("/admin/anggota");
      router.refresh();
    } catch (e) {
      toast("error", (e as Error).message);
    }
  }

  async function restore() {
    startTransition(async () => {
      const res = await fetch("/api/admin/relasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore-person", personId: person.id }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast("error", (d as { error?: string }).error ?? "Gagal memulihkan");
      return;
    }
    toast("success", "Anggota dipulihkan.");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-start gap-5">
        <Avatar name={person.fullName} photoUrl={person.photoUrl} size="xl" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-semibold text-forest">
            {person.fullName}
          </h1>
          {person.nickname && <p className="text-sm text-muted">{person.nickname}</p>}
          <p className="mt-1 text-sm text-wood">
            {person.branch?.name ?? "Tanpa cabang"}
            {person.isDeceased && " · Almarhum/Almarhumah"}
          </p>
          {person.deletedAt && (
            <p className="mt-2 rounded-md bg-wood/10 px-3 py-2 text-sm text-wood">
              Anggota ini ada di arsip.
            </p>
          )}
        </div>
      </div>

      <div className="mt-8 space-y-6">
        <Section title="Identitas">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Row label="Jenis kelamin" value={person.gender === "MALE" ? "Laki-laki" : person.gender === "FEMALE" ? "Perempuan" : "Lainnya"} />
            <Row label="Level generasi" value={person.generationLevel?.toString() ?? "Belum dihitung"} />
            <Row label="Tanggal lahir" value={person.birthDate ? new Date(person.birthDate).toLocaleDateString("id-ID") : "-"} />
            <Row label="Tempat lahir" value={person.birthPlace ?? "-"} />
            {person.deathDate && <Row label="Tanggal wafat" value={new Date(person.deathDate).toLocaleDateString("id-ID")} />}
            <Row label="Akun" value={person.user ? `${person.user.email} (${person.user.role})` : "Belum punya akun"} />
          </dl>
          {person.bio && <p className="mt-4 text-sm leading-relaxed text-muted">{person.bio}</p>}
        </Section>

        {person.private && (
          <Section title="Kontak (privat)">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Row label="Telepon" value={person.private.phone ?? "-"} />
              <Row label="WhatsApp" value={person.private.whatsapp ?? "-"} />
              <Row label="Email" value={person.private.email ?? "-"} />
              <Row label="Kota" value={person.private.city ?? "-"} />
              <Row label="Alamat" value={person.private.addressLine ?? "-"} />
            </dl>
          </Section>
        )}

        <Section title="Orang Tua">
          <RelationList
            items={person.parents.map((p) => ({
              key: p.id,
              name: p.parent.fullName,
              photoUrl: p.parent.photoUrl,
              tag: `${p.parentRole === "FATHER" ? "Bapak" : p.parentRole === "MOTHER" ? "Ibu" : "Wali"}${p.isStep ? " (tiri)" : ""}${p.isAdopted ? " (angkat)" : ""}`,
              edgeId: p.id,
            }))}
            emptyText="Belum ada data orang tua."
          />
          <RelationAdder
            personId={person.id}
            relationType="parent"
            label="Tambah orang tua dari anggota:"
            onDone={() => router.refresh()}
          />
        </Section>

        <Section title="Pasangan">
          <RelationList
            items={partners.map((p) => ({
              key: p.edgeId,
              name: p.member.fullName,
              photoUrl: p.member.photoUrl,
              tag: p.status === "MARRIED" ? "Menikah" : p.status === "DIVORCED" ? "Cerai" : p.status === "WIDOWED" ? "Janda/Duda" : "-",
              edgeId: p.edgeId,
            }))}
            emptyText="Belum ada data pasangan."
          />
          <RelationAdder
            personId={person.id}
            relationType="partner"
            label="Tambah pasangan dari anggota:"
            onDone={() => router.refresh()}
          />
        </Section>

        <Section title="Anak">
          <RelationList
            items={person.children.map((c) => ({
              key: c.id,
              name: c.child.fullName,
              photoUrl: c.child.photoUrl,
              tag: `${c.isStep ? "Tiri" : c.isAdopted ? "Angkat" : "Kandung"}`,
              edgeId: c.id,
            }))}
            emptyText="Belum ada data anak."
          />
          <RelationAdder
            personId={person.id}
            relationType="child"
            label="Tambah anak dari anggota:"
            onDone={() => router.refresh()}
          />
        </Section>

        <Section title="Catatan Admin">
          {person.adminNotes.length === 0 ? (
            <p className="text-sm text-muted">Belum ada catatan.</p>
          ) : (
            <ul className="space-y-3">
              {person.adminNotes.map((n) => (
                <li key={n.id} className="rounded-md border border-wood/15 bg-parchment/40 p-3">
                  <p className="text-sm text-forest">{n.body}</p>
                  <p className="mt-1 text-xs text-muted">
                    {n.author.person.fullName} · {new Date(n.createdAt).toLocaleDateString("id-ID")}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <AdminNoteAdder personId={person.id} onDone={() => router.refresh()} />
        </Section>
      </div>

      {/* Aksi */}
      <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-wood/15 pt-6">
        {person.deletedAt ? (
          <button
            type="button"
            onClick={restore}
            disabled={pending}
            className="rounded-md bg-forest px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft disabled:opacity-50"
          >
            {pending ? "Memulihkan..." : "Pulihkan dari arsip"}
          </button>
        ) : (
          isSuperAdmin && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="rounded-md border border-wood/30 px-4 py-2 text-sm font-medium text-wood transition-colors hover:bg-wood/10"
            >
              Arsipkan anggota
            </button>
          )
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={softDelete}
        title="Arsipkan anggota"
        message={`${person.fullName} akan dipindahkan ke arsip dan tidak tampil di silsilah. Data tetap tersimpan dan bisa dipulihkan.`}
        confirmLabel="Arsipkan"
        variant="danger"
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-wood/15 bg-cream p-5">
      <h2 className="font-display text-lg font-semibold text-forest">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-forest">{value}</dd>
    </div>
  );
}

function RelationList({
  items,
  emptyText,
}: {
  items: Array<{ key: string; name: string; photoUrl?: string | null; tag: string; edgeId: string }>;
  emptyText: string;
}) {
  if (items.length === 0) return <p className="text-sm text-muted">{emptyText}</p>;
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.key} className="flex items-center gap-3 text-sm">
          <Avatar name={i.name} photoUrl={i.photoUrl} size="sm" />
          <span className="font-medium text-forest">{i.name}</span>
          <span className="text-xs text-muted">({i.tag})</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Tambah relasi dengan mencari anggota yang sudah ada.
 * Menghindari duplikasi edge; validasi di sisi server (api/admin/relasi).
 */
function RelationAdder({
  personId,
  relationType,
  label,
  onDone,
}: {
  personId: string;
  relationType: "parent" | "child" | "partner";
  label: string;
  onDone: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Array<{ id: string; fullName: string }>>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function search() {
    if (q.trim().length < 2) { setResults([]); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/cari-orang?q=${encodeURIComponent(q)}`);
      const d = await res.json();
      setResults((d as Array<{ id: string; fullName: string }>));
    } catch {
      setResults([]);
    } finally {
      setBusy(false);
    }
  }

  async function attach() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/relasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", personId, relationType, targetPersonId: selected }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast("error", (d as { error?: string }).error ?? "Gagal menambah relasi");
        return;
      }
      toast("success", "Relasi ditambahkan.");
      setSelected(null);
      setResults([]);
      setQ("");
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 border-t border-wood/10 pt-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <div className="mt-2 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); search(); } }}
          placeholder="Ketik nama, minimal 2 huruf…"
          className="flex-1 rounded-md border border-wood/25 bg-cream px-3 py-1.5 text-sm text-forest placeholder:text-muted/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
        />
        <button
          type="button"
          onClick={search}
          disabled={busy}
          className="rounded-md border border-wood/25 px-3 py-1.5 text-xs text-muted transition-colors hover:bg-wood/10 disabled:opacity-50"
        >
          {busy && !selected ? "Mencari..." : "Cari"}
        </button>
      </div>

      {results.length > 0 && (
        <ul className="mt-2 max-h-40 overflow-y-auto rounded-md border border-wood/15 bg-parchment/40">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => { setSelected(r.id); setResults([]); }}
                className="block w-full px-3 py-2 text-left text-sm text-forest hover:bg-wood/10"
              >
                {r.fullName}
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <div className="mt-2 flex items-center gap-2">
          <p className="text-xs text-forest">Terpilih: ID {selected.slice(0, 8)}…</p>
          <button
            type="button"
            onClick={attach}
            disabled={busy}
            className="rounded-md bg-gold px-3 py-1.5 text-xs font-semibold text-forest transition-colors hover:bg-gold-deep disabled:opacity-50"
          >
            {busy ? "Menyimpan..." : "Simpan relasi"}
          </button>
        </div>
      )}
    </div>
  );
}

function AdminNoteAdder({ personId, onDone }: { personId: string; onDone: () => void }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!body.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/relasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add-note", personId, body }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast("error", (d as { error?: string }).error ?? "Gagal menyimpan catatan");
        return;
      }
      toast("success", "Catatan tersimpan.");
      setBody("");
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 border-t border-wood/10 pt-4">
      <label htmlFor="note" className={labelCls}>Catatan baru (internal, tidak tampil untuk anggota)</label>
      <textarea id="note" rows={2} value={body} onChange={(e) => setBody(e.target.value)} className={inputCls} />
      <button
        type="button"
        onClick={save}
        disabled={busy || !body.trim()}
        className="mt-2 rounded-md bg-forest px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft disabled:opacity-50"
      >
        {busy ? "Menyimpan..." : "Simpan catatan"}
      </button>
    </div>
  );
}
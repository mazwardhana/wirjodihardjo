"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { toast } from "@/components/ui/Toast";

export type FamilyTreeModalProps = {
  personId: string;
  branchId: string;
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

type RelasiPayload = {
  person: TreeMember & { fullName: string };
  branch: { id: string; name: string; branchNumber: number } | null;
  ancestors: AncestorLevel[];
  siblings: SiblingSection[];
  descendants: DescendantLevel[];
  parents: ParentEntry[];
  children: ChildEntry[];
};

type BranchMember = {
  id: string;
  fullName: string;
  nickname: string | null;
  gender: string;
  generationLevel: number | null;
  isDeceased: boolean;
};

type ParentRole = "FATHER" | "MOTHER";

const inputCls =
  "block w-full min-h-11 rounded-md border border-wood/30 bg-cream px-4 py-2.5 text-sm text-forest placeholder:text-muted/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30";
const sectionTitleCls = "font-display text-base font-semibold text-forest";
const cardCls = "rounded-lg border border-wood/20 bg-parchment/30 p-4";

function MemberList({ members, emptyText }: { members: TreeMember[]; emptyText?: string }) {
  if (members.length === 0) {
    return <p className="text-sm text-muted">{emptyText ?? "(Kosong)"}</p>;
  }
  return (
    <ul className="space-y-1">
      {members.map((member) => (
        <li key={member.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-medium text-forest">{member.fullName}</span>
          <span className="text-muted">
            {member.isDeceased ? "Wafat" : member.generationLevel === null ? "Generasi belum ditetapkan" : `Generasi ${member.generationLevel}`}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ParentPicker({
  title,
  hint,
  role,
  options,
  currentValue,
  busy,
  error,
  onPick,
}: {
  title: string;
  hint: string;
  role: ParentRole;
  options: BranchMember[];
  currentValue: ParentEntry | undefined;
  busy: boolean;
  error: string | null;
  onPick: (role: ParentRole, target: BranchMember) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return options
      .filter((m) => m.id !== currentValue?.id)
      .filter(
        (m) =>
          m.fullName.toLowerCase().includes(q) ||
          (m.nickname ?? "").toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [query, options, currentValue]);

  const fieldId = `parent-search-${role}`;

  return (
    <div className={cardCls}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className={sectionTitleCls}>{title}</h3>
        {currentValue && (
          <span className="text-sm text-muted">
            Saat ini: <span className="font-medium text-forest">{currentValue.fullName}</span>
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">{hint}</p>

      <div className="relative mt-3">
        <label htmlFor={fieldId} className="sr-only">
          {title}
        </label>
        <input
          id={fieldId}
          type="search"
          autoComplete="off"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Ketik nama anggota cabang ini..."
          className={inputCls}
        />
        {open && filtered.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-wood/20 bg-cream py-1 shadow-lg">
            {filtered.map((member) => (
              <li key={member.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(role, member);
                    setQuery("");
                    setOpen(false);
                  }}
                  disabled={busy}
                  className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-forest transition-colors hover:bg-wood/10 disabled:opacity-50"
                >
                  <span className="truncate">
                    {member.fullName}
                    {member.nickname ? <span className="text-muted"> ({member.nickname})</span> : null}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {member.gender === "FEMALE" ? "Perempuan" : "Laki-laki"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 rounded-md bg-wood/10 p-2 text-sm text-wood">
          {error}
        </p>
      )}
    </div>
  );
}

export function FamilyTreeModal({ personId, branchId, onClose }: FamilyTreeModalProps) {
  const [data, setData] = useState<RelasiPayload | null>(null);
  const [members, setMembers] = useState<BranchMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyRole, setBusyRole] = useState<ParentRole | null>(null);
  const [roleError, setRoleError] = useState<Record<ParentRole, string | null>>({
    FATHER: null,
    MOTHER: null,
  });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [relasiRes, membersRes] = await Promise.all([
          fetch(`/api/admin/keluarga/relasi?personId=${encodeURIComponent(personId)}`, {
            signal,
          }),
          fetch(`/api/admin/keluarga/members?branchId=${encodeURIComponent(branchId)}`, {
            signal,
          }),
        ]);

        if (!relasiRes.ok) {
          const body = (await relasiRes.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Gagal memuat data relasi keluarga");
        }

        const relasi = (await relasiRes.json()) as RelasiPayload;
        setData(relasi);

        if (membersRes.ok) {
          const body = (await membersRes.json()) as { members?: BranchMember[] };
          setMembers(body.members ?? []);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Gagal memuat data relasi keluarga");
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [personId, branchId, reloadKey]);

  async function saveParent(role: ParentRole, target: BranchMember) {
    setBusyRole(role);
    setRoleError((prev) => ({ ...prev, [role]: null }));
    try {
      const res = await fetch("/api/admin/relasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          relationType: "parent",
          personId,
          targetPersonId: target.id,
          role,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Gagal menyimpan relasi orang tua");

      toast("success", role === "FATHER" ? "Relasi ayah berhasil disimpan." : "Relasi ibu berhasil disimpan.");
      setReloadKey((key) => key + 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal menyimpan relasi orang tua";
      setRoleError((prev) => ({ ...prev, [role]: message }));
    } finally {
      setBusyRole(null);
    }
  }

  const father = data?.parents.find((p) => p.role === "FATHER");
  const mother = data?.parents.find((p) => p.role === "MOTHER");
  const ancestorRows = [...(data?.ancestors ?? [])].reverse();

  return (
    <Dialog
      open
      onClose={onClose}
      title="Form Family Tree"
      description="Tetapkan posisi anggota ini di dalam pohon keluarga."
      size="lg"
    >
      {loading && !data ? (
        <div role="status" className="py-10 text-center text-sm text-muted">
          Memuat data relasi...
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
      ) : data ? (
        <div className="space-y-5">
          {/* 1. Info cabang */}
          <section className="rounded-lg border border-gold/40 bg-gold/10 p-4">
            <p className="text-xs uppercase tracking-wide text-gold-deep">Data Keluarga cabang mana?</p>
            <p className="mt-1 font-display text-lg font-semibold text-forest">
              {data.branch ? data.branch.name : "Cabang tidak diketahui"}
            </p>
            <p className="text-sm text-muted">
              {data.branch ? `Cabang nomor ${data.branch.branchNumber}` : "Anggota ini belum terikat cabang."}
            </p>
            <p className="mt-2 text-sm text-forest">
              Anggota: <span className="font-semibold">{data.person.fullName}</span>
            </p>
          </section>

          {/* 2 & 3. Orang tua */}
          <section className="space-y-4">
            <h3 className={sectionTitleCls}>Orang tua</h3>
            <ParentPicker
              title="Masukan nama ayah"
              hint="Cari anggota dari cabang yang sama, lalu pilih untuk menetapkan relasi ayah."
              role="FATHER"
              options={members}
              currentValue={father}
              busy={busyRole === "FATHER"}
              error={roleError.FATHER}
              onPick={saveParent}
            />
            <ParentPicker
              title="Masukan nama ibu"
              hint="Cari anggota dari cabang yang sama, lalu pilih untuk menetapkan relasi ibu."
              role="MOTHER"
              options={members}
              currentValue={mother}
              busy={busyRole === "MOTHER"}
              error={roleError.MOTHER}
              onPick={saveParent}
            />
          </section>

          {/* 4. Generasi ke atas */}
          <section>
            <h3 className={sectionTitleCls}>Daftar generasi ke atas</h3>
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

          {/* 5. Saudara */}
          <section>
            <h3 className={sectionTitleCls}>Informasi saudara</h3>
            {data.siblings.length === 0 ? (
              <div className={cardCls}>
                <p className="text-sm text-muted">Belum ada data saudara.</p>
              </div>
            ) : (
              <div className="space-y-3">
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

          {/* 6. Generasi di bawahnya */}
          <section>
            <h3 className={sectionTitleCls}>Informasi generasi di bawahnya</h3>
            <div className="mt-3 rounded-md border border-wood/15 divide-y divide-wood/10">
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

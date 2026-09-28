"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { toast } from "@/components/ui/Toast";
import {
  PARENT_SEARCH_MIN_LENGTH,
  buildParentSearchUrl,
  createParentSearch,
  type ParentSearchState,
} from "./parent-search";

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

type ParentEntry = TreeMember & { edgeId: string; role: string; isStep: boolean; isAdopted: boolean };
type ChildEntry = TreeMember & { edgeId: string; isStep: boolean; isAdopted: boolean };
type PartnerEntry = { edgeId: string; status: string; member: TreeMember };

type RelasiPayload = {
  person: TreeMember & { fullName: string };
  branch: { id: string; name: string; branchNumber: number } | null;
  ancestors: AncestorLevel[];
  siblings: SiblingSection[];
  descendants: DescendantLevel[];
  parents: ParentEntry[];
  children: ChildEntry[];
  partners: PartnerEntry[];
};

type NewPersonDraft = {
  fullName: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  birthDate: string;
  birthPlace: string;
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

function partnerStatusLabel(status: string): string {
  if (status === "DIVORCED") return "Cerai";
  if (status === "WIDOWED") return "Pasangan wafat";
  return "Menikah";
}

function NewPersonForm({
  title,
  withBirthPlace,
  busy,
  onCancel,
  onSubmit,
}: {
  title: string;
  withBirthPlace?: boolean;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (draft: NewPersonDraft) => void;
}) {
  const [draft, setDraft] = useState<NewPersonDraft>({
    fullName: "",
    gender: "MALE",
    birthDate: "",
    birthPlace: "",
  });
  const fieldId = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(draft);
      }}
      className="space-y-3 rounded-md border border-wood/20 bg-cream p-3"
    >
      <p className="text-sm font-medium text-forest">{title}</p>

      <div>
        <label htmlFor={`${fieldId}-name`} className="block text-sm font-medium text-forest">
          Nama Lengkap
        </label>
        <input
          id={`${fieldId}-name`}
          value={draft.fullName}
          onChange={(event) => setDraft({ ...draft, fullName: event.target.value })}
          className={inputCls}
          required
        />
      </div>

      <div>
        <label htmlFor={`${fieldId}-gender`} className="block text-sm font-medium text-forest">
          Jenis Kelamin
        </label>
        <select
          id={`${fieldId}-gender`}
          value={draft.gender}
          onChange={(event) =>
            setDraft({ ...draft, gender: event.target.value as NewPersonDraft["gender"] })
          }
          className={inputCls}
        >
          <option value="MALE">Laki-laki</option>
          <option value="FEMALE">Perempuan</option>
          <option value="OTHER">Lainnya</option>
        </select>
      </div>

      <div>
        <label htmlFor={`${fieldId}-birth`} className="block text-sm font-medium text-forest">
          Tanggal Lahir
        </label>
        <input
          id={`${fieldId}-birth`}
          type="date"
          value={draft.birthDate}
          onChange={(event) => setDraft({ ...draft, birthDate: event.target.value })}
          className={inputCls}
        />
      </div>

      {withBirthPlace && (
        <div>
          <label htmlFor={`${fieldId}-place`} className="block text-sm font-medium text-forest">
            Tempat Lahir
          </label>
          <input
            id={`${fieldId}-place`}
            value={draft.birthPlace}
            onChange={(event) => setDraft({ ...draft, birthPlace: event.target.value })}
            className={inputCls}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy || !draft.fullName.trim()}
          className="min-h-11 rounded-md bg-forest px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft disabled:opacity-50"
        >
          Simpan
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="min-h-11 rounded-md border border-wood/30 px-4 py-2 text-sm font-semibold text-forest transition-colors hover:bg-wood/10 disabled:opacity-50"
        >
          Batal
        </button>
      </div>
    </form>
  );
}

function ParentPicker({
  title,
  hint,
  role,
  currentValue,
  busy,
  removing,
  error,
  onPick,
  onRemove,
  onCreate,
  onSearch,
}: {
  title: string;
  hint: string;
  role: ParentRole;
  currentValue: ParentEntry | undefined;
  busy: boolean;
  removing: boolean;
  error: string | null;
  onPick: (role: ParentRole, target: BranchMember) => void;
  onRemove: () => void;
  onCreate: (draft: NewPersonDraft) => Promise<boolean>;
  onSearch: (query: string, signal?: AbortSignal) => Promise<BranchMember[]>;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [searchState, setSearchState] = useState<ParentSearchState<BranchMember>>({
    options: [],
    searching: false,
    error: null,
  });

  // Prop onSearch bisa berubah tiap render, jadi simpan di ref dan isi ulang lewat efek.
  const onSearchRef = useRef(onSearch);
  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  // Mesin pencarian dibuat sekali setelah komponen terpasang, bukan saat render.
  const searchRef = useRef<ReturnType<typeof createParentSearch<BranchMember>> | null>(null);
  useEffect(() => {
    const searcher = createParentSearch<BranchMember>({
      fetchMembers: (q, signal) => onSearchRef.current(q, signal),
      onChange: setSearchState,
    });
    searchRef.current = searcher;
    return () => {
      searcher.cancel();
      searchRef.current = null;
    };
  }, []);

  const { options, searching, error: searchError } = searchState;
  const results = options.filter((member) => member.id !== currentValue?.id);
  const showResults = query.trim().length >= PARENT_SEARCH_MIN_LENGTH;
  const fieldId = `parent-search-${role}`;

  return (
    <div className={cardCls}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className={sectionTitleCls}>{title}</h3>
        <div className="flex items-center gap-3">
          {currentValue && (
            <span className="text-sm text-muted">
              Saat ini:{" "}
              <span className="font-medium text-forest">{currentValue.fullName}</span>
            </span>
          )}
          {currentValue && currentValue.edgeId && (
            <button
              type="button"
              onClick={onRemove}
              disabled={removing}
              className="min-h-11 rounded-md px-3 py-2 text-xs font-medium text-wood underline transition-colors hover:bg-wood/10 disabled:opacity-50"
            >
              Hapus relasi
            </button>
          )}
        </div>
      </div>
      <p className="mt-1 text-sm text-muted">{hint}</p>

      {creating ? (
        <div className="mt-3">
          <NewPersonForm
            title={`${title} baru`}
            busy={busy || removing}
            onCancel={() => setCreating(false)}
            onSubmit={async (draft) => {
              const ok = await onCreate(draft);
              if (ok) {
                setCreating(false);
                setQuery("");
                setOpen(false);
              }
            }}
          />
        </div>
      ) : (
        <>
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
                const value = event.target.value;
                setQuery(value);
                setOpen(true);
                searchRef.current?.search(value);
              }}
              onFocus={() => setOpen(true)}
              placeholder="Ketik nama anggota cabang ini..."
              className={inputCls}
            />
            {open && showResults && (searching || searchError === null) && (
              <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-wood/20 bg-cream py-1 shadow-lg">
                {searching ? (
                  <p role="status" className="px-3 py-2 text-sm text-muted">
                    Mencari anggota...
                  </p>
                ) : (
                  <ul>
                    {results.map((member) => (
                      <li key={member.id}>
                        <button
                          type="button"
                          onClick={() => {
                            onPick(role, member);
                            searchRef.current?.cancel();
                            setQuery("");
                            setOpen(false);
                          }}
                          disabled={busy}
                          className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-forest transition-colors hover:bg-wood/10 disabled:opacity-50"
                        >
                          <span className="truncate">
                            {member.fullName}
                            {member.nickname ? (
                              <span className="text-muted"> ({member.nickname})</span>
                            ) : null}
                          </span>
                          <span className="shrink-0 text-xs text-muted">
                            {member.gender === "FEMALE" ? "Perempuan" : "Laki-laki"}
                          </span>
                        </button>
                      </li>
                    ))}
                    {searchError === null && results.length === 0 && (
                      <li className="px-3 py-2 text-sm text-muted">Anggota tidak ditemukan</li>
                    )}
                  </ul>
                )}
              </div>
            )}
          </div>

          {searchError && (
            <p role="alert" className="mt-2 rounded-md bg-wood/10 p-2 text-sm text-wood">
              {searchError}
            </p>
          )}

          {!currentValue && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setCreating(true);
              }}
              disabled={busy || removing}
              className="mt-3 min-h-11 rounded-md border border-forest px-4 py-2 text-sm font-semibold text-forest transition-colors hover:bg-forest/10 disabled:opacity-50"
            >
              Tidak menemukan? Buat anggota baru
            </button>
          )}
        </>
      )}

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyRole, setBusyRole] = useState<ParentRole | null>(null);
  const [roleError, setRoleError] = useState<Record<ParentRole, string | null>>({
    FATHER: null,
    MOTHER: null,
  });
  const [removingEdgeId, setRemovingEdgeId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showPartnerForm, setShowPartnerForm] = useState(false);
  const [showChildForm, setShowChildForm] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const relasiRes = await fetch(
          `/api/admin/keluarga/relasi?personId=${encodeURIComponent(personId)}`,
          { signal },
        );

        if (!relasiRes.ok) {
          const body = (await relasiRes.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Gagal memuat data relasi keluarga");
        }

        const relasi = (await relasiRes.json()) as RelasiPayload;
        setData(relasi);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Gagal memuat data relasi keluarga");
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [personId, reloadKey]);

  const searchMembers = useCallback(
    async (q: string, signal?: AbortSignal): Promise<BranchMember[]> => {
      const res = await fetch(buildParentSearchUrl(branchId, q), { signal });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Gagal mencari anggota cabang");
      }
      const body = (await res.json()) as { members?: BranchMember[] };
      return body.members ?? [];
    },
    [branchId],
  );

  async function mutate(
    body: Record<string, unknown>,
    successMessage: string,
  ): Promise<boolean> {
    setSaveError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/relasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Gagal menyimpan relasi");

      toast("success", successMessage);
      setReloadKey((key) => key + 1);
      return true;
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Gagal menyimpan relasi");
      return false;
    } finally {
      setSaving(false);
    }
  }

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

  async function createParent(role: ParentRole, draft: NewPersonDraft): Promise<boolean> {
    setBusyRole(role);
    setRoleError((prev) => ({ ...prev, [role]: null }));
    try {
      const res = await fetch("/api/admin/relasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add-new",
          relationType: "parent",
          personId,
          role,
          ...draft,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Gagal menambah orang tua baru");

      toast("success", role === "FATHER" ? "Ayah baru berhasil ditambahkan." : "Ibu baru berhasil ditambahkan.");
      setReloadKey((key) => key + 1);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal menambah orang tua baru";
      setRoleError((prev) => ({ ...prev, [role]: message }));
      return false;
    } finally {
      setBusyRole(null);
    }
  }

  async function removeRelation(
    relationType: "parent" | "child" | "partner",
    edgeId: string,
  ) {
    if (typeof window !== "undefined" && !window.confirm("Hapus relasi ini?")) return;
    setRemovingEdgeId(edgeId);
    try {
      await mutate(
        { action: "remove", relationType, edgeId, personId },
        "Relasi berhasil dihapus.",
      );
    } finally {
      setRemovingEdgeId(null);
    }
  }

  async function createChild(draft: NewPersonDraft): Promise<boolean> {
    const ok = await mutate(
      { action: "add-new", relationType: "child", personId, ...draft },
      "Anak baru berhasil ditambahkan.",
    );
    if (ok) setShowChildForm(false);
    return ok;
  }

  async function createPartner(draft: NewPersonDraft): Promise<boolean> {
    const ok = await mutate(
      { action: "add-new", relationType: "partner", personId, ...draft },
      "Pasangan baru berhasil ditambahkan.",
    );
    if (ok) setShowPartnerForm(false);
    return ok;
  }

  const father = data?.parents.find((p) => p.role === "FATHER");
  const mother = data?.parents.find((p) => p.role === "MOTHER");
  const ancestorRows = [...(data?.ancestors ?? [])].reverse();
  const partners = data?.partners ?? [];
  const children = data?.children ?? [];

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

          {saveError && (
            <p role="alert" className="rounded-md bg-wood/10 p-3 text-sm text-wood">
              {saveError}
            </p>
          )}

          {/* 2 & 3. Orang tua */}
          <section className="space-y-4">
            <h3 className={sectionTitleCls}>Orang tua</h3>
            <ParentPicker
              title="Masukan nama ayah"
              hint="Cari anggota dari cabang yang sama, lalu pilih untuk menetapkan relasi ayah. Bila belum ada di data, buat anggota baru."
              role="FATHER"
              currentValue={father}
              busy={busyRole === "FATHER"}
              removing={Boolean(father && removingEdgeId === father.edgeId)}
              error={roleError.FATHER}
              onPick={saveParent}
              onRemove={() => father && removeRelation("parent", father.edgeId)}
              onCreate={(draft) => createParent("FATHER", draft)}
              onSearch={searchMembers}
            />
            <ParentPicker
              title="Masukan nama ibu"
              hint="Cari anggota dari cabang yang sama, lalu pilih untuk menetapkan relasi ibu. Bila belum ada di data, buat anggota baru."
              role="MOTHER"
              currentValue={mother}
              busy={busyRole === "MOTHER"}
              removing={Boolean(mother && removingEdgeId === mother.edgeId)}
              error={roleError.MOTHER}
              onPick={saveParent}
              onRemove={() => mother && removeRelation("parent", mother.edgeId)}
              onCreate={(draft) => createParent("MOTHER", draft)}
              onSearch={searchMembers}
            />
          </section>

          {/* 3b. Pasangan */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className={sectionTitleCls}>Pasangan</h3>
              {!showPartnerForm && (
                <button
                  type="button"
                  onClick={() => setShowPartnerForm(true)}
                  disabled={saving}
                  className="min-h-11 rounded-md border border-forest px-4 py-2 text-sm font-semibold text-forest transition-colors hover:bg-forest/10 disabled:opacity-50"
                >
                  Tambah pasangan
                </button>
              )}
            </div>

            {partners.length === 0 ? (
              <div className={cardCls}>
                <p className="text-sm text-muted">Belum ada data pasangan.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {partners.map((partner) => (
                  <li
                    key={partner.edgeId}
                    className={`${cardCls} flex flex-wrap items-center justify-between gap-2`}
                  >
                    <span className="text-sm text-forest">
                      <span className="font-medium">{partner.member.fullName}</span>
                      <span className="text-muted"> - {partnerStatusLabel(partner.status)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeRelation("partner", partner.edgeId)}
                      disabled={removingEdgeId === partner.edgeId}
                      className="min-h-11 rounded-md px-3 py-2 text-xs font-medium text-wood underline transition-colors hover:bg-wood/10 disabled:opacity-50"
                    >
                      Hapus relasi
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {showPartnerForm && (
              <NewPersonForm
                title="Pasangan baru"
                busy={saving}
                onCancel={() => setShowPartnerForm(false)}
                onSubmit={createPartner}
              />
            )}
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

          {/* 6. Anak langsung */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className={sectionTitleCls}>Anak</h3>
              {!showChildForm && (
                <button
                  type="button"
                  onClick={() => setShowChildForm(true)}
                  disabled={saving}
                  className="min-h-11 rounded-md border border-forest px-4 py-2 text-sm font-semibold text-forest transition-colors hover:bg-forest/10 disabled:opacity-50"
                >
                  Tambah anak
                </button>
              )}
            </div>

            {children.length === 0 ? (
              <div className={cardCls}>
                <p className="text-sm text-muted">Belum ada data anak.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {children.map((child) => (
                  <li
                    key={child.edgeId}
                    className={`${cardCls} flex flex-wrap items-center justify-between gap-2`}
                  >
                    <span className="text-sm text-forest">
                      <span className="font-medium">{child.fullName}</span>
                      <span className="text-muted">
                        {child.isDeceased ? " - Wafat" : ""}
                        {child.isStep ? " - Anak tiri" : ""}
                        {child.isAdopted ? " - Anak angkat" : ""}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeRelation("child", child.edgeId)}
                      disabled={removingEdgeId === child.edgeId}
                      className="min-h-11 rounded-md px-3 py-2 text-xs font-medium text-wood underline transition-colors hover:bg-wood/10 disabled:opacity-50"
                    >
                      Hapus relasi
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {showChildForm && (
              <NewPersonForm
                title="Anak baru"
                withBirthPlace
                busy={saving}
                onCancel={() => setShowChildForm(false)}
                onSubmit={createChild}
              />
            )}
          </section>

          {/* 7. Generasi di bawahnya */}
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

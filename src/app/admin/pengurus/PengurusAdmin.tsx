"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export type AdminAssignment = {
  id: string;
  startDate: string;
  endDate: string | null;
  notes: string | null;
  person: {
    id: string;
    fullName: string;
    branchName: string | null;
    branchNumber: number | null;
  };
};

export type AdminPosition = {
  id: string;
  name: string;
  description: string | null;
  level: number;
  capacity: number | null;
  assignments: AdminAssignment[];
};

export type AdminStructure = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  startDate: string;
  endDate: string | null;
  positions: AdminPosition[];
};

export type AdminBranch = { id: string; name: string; branchNumber: number };

export type AdminRepresentative = {
  id: string;
  branchId: string;
  slot: number;
  person: {
    id: string;
    fullName: string;
    branchName: string | null;
    branchNumber: number | null;
  };
};

const inputCls =
  "w-full min-h-11 rounded-md border border-wood/30 bg-cream px-3 py-2 text-sm text-forest focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/30";
const buttonPrimary =
  "min-h-11 rounded-md bg-forest px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest";
const buttonGhost =
  "min-h-11 rounded-md border border-wood/30 px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-wood/10 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest";
const buttonDanger =
  "min-h-11 rounded-md border border-wood/20 px-3 py-2 text-xs font-medium text-wood transition-colors hover:bg-wood/10 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest";

function todayInput(): string {
  return new Date().toISOString().slice(0, 10);
}

type PersonOption = { id: string; fullName: string };

/** Pencarian anggota dengan debounce, memakai endpoint cari-orang yang ada. */
function PersonPicker({
  label,
  onPick,
  busy,
}: {
  label: string;
  onPick: (person: PersonOption) => void;
  busy: boolean;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PersonOption[]>([]);
  const [searching, setSearching] = useState(false);
  const term = q.trim();
  const tooShort = term.length < 2;

  useEffect(() => {
    if (tooShort) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/cari-orang?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        if (res.ok) setResults((await res.json()) as PersonOption[]);
      } catch {
        // Permintaan dibatalkan saat query berubah; abaikan.
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, tooShort]);

  const visibleResults = tooShort ? [] : results;
  const showSearching = !tooShort && searching;

  return (
    <div className="relative">
      <label className="block text-xs font-medium text-muted">{label}</label>
      <input
        type="search"
        autoComplete="off"
        value={q}
        disabled={busy}
        onChange={(event) => setQ(event.target.value)}
        placeholder="Ketik minimal 2 huruf nama..."
        className={inputCls}
      />
      {showSearching && <p className="mt-1 text-xs text-muted">Mencari...</p>}
      {visibleResults.length > 0 && (
        <ul className="mt-1 max-h-52 overflow-y-auto rounded-md border border-wood/20 bg-cream py-1 shadow-sm">
          {visibleResults.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  onPick(person);
                  setQ("");
                  setResults([]);
                }}
                className="flex min-h-11 w-full items-center px-3 py-2 text-left text-sm text-forest hover:bg-wood/10 disabled:opacity-50"
              >
                {person.fullName}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!tooShort && !searching && results.length === 0 && (
        <p className="mt-1 text-xs text-muted">Tidak ada anggota yang cocok.</p>
      )}
    </div>
  );
}

/** Kartu satu jabatan: daftar pengurus, tambah pengurus, edit, dan hapus. */
function PositionCard({
  position,
  onChanged,
}: {
  position: AdminPosition;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState(position.name);
  const [level, setLevel] = useState(String(position.level));
  const [description, setDescription] = useState(position.description ?? "");
  const [startDate, setStartDate] = useState(todayInput());

  async function send(url: string, method: string, body?: unknown): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Gagal menyimpan");
      return true;
    } catch (error) {
      toast("error", (error as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function assign(person: PersonOption) {
    const ok = await send("/api/admin/governance/assignment", "POST", {
      positionId: position.id,
      personId: person.id,
      startDate,
    });
    if (ok) {
      toast("success", `${person.fullName} ditetapkan sebagai ${position.name}.`);
      setShowAdd(false);
      onChanged();
    }
  }

  async function removeAssignment(assignment: AdminAssignment) {
    const ok = await send(
      `/api/admin/governance/assignment?id=${encodeURIComponent(assignment.id)}`,
      "DELETE",
    );
    if (ok) {
      toast("success", "Pengurus dihapus dari jabatan.");
      onChanged();
    }
  }

  async function savePosition() {
    const ok = await send("/api/admin/governance/position", "PUT", {
      id: position.id,
      name,
      description,
      level: Number(level) || 0,
    });
    if (ok) {
      toast("success", "Jabatan diperbarui.");
      setEditing(false);
      onChanged();
    }
  }

  async function deletePosition() {
    const ok = await send(
      `/api/admin/governance/position?id=${encodeURIComponent(position.id)}`,
      "DELETE",
    );
    if (ok) {
      toast("success", "Jabatan dihapus.");
      onChanged();
    }
  }

  return (
    <li className="rounded-lg border border-wood/15 bg-cream p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold text-forest">
            {position.name}
          </h3>
          <p className="text-xs text-muted">Tingkat {position.level}</p>
          {position.description && (
            <p className="mt-1 text-sm text-muted">{position.description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" disabled={busy} onClick={() => setEditing((v) => !v)} className={buttonGhost}>
            Edit
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
            className={buttonDanger}
          >
            Hapus
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-3 grid gap-3 rounded-md border border-wood/15 bg-parchment/30 p-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-muted">Nama jabatan</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted">Tingkat</span>
            <input
              type="number"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-muted">Deskripsi</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputCls}
            />
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button type="button" disabled={busy} onClick={savePosition} className={buttonPrimary}>
              Simpan
            </button>
            <button type="button" disabled={busy} onClick={() => setEditing(false)} className={buttonGhost}>
              Batal
            </button>
          </div>
        </div>
      )}

      <ul className="mt-3 space-y-2">
        {position.assignments.length === 0 ? (
          <li className="rounded-md border border-dashed border-wood/20 bg-parchment/30 px-3 py-2 text-sm italic text-muted/70">
            (Kosong)
          </li>
        ) : (
          position.assignments.map((assignment) => (
            <li
              key={assignment.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-wood/15 bg-parchment/20 px-3 py-2"
            >
              <span className="text-sm text-forest">
                <span className="font-medium">{assignment.person.fullName}</span>
                {assignment.person.branchName && (
                  <span className="text-muted">
                    {" "}
                    - Cabang {assignment.person.branchNumber}: {assignment.person.branchName}
                  </span>
                )}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => removeAssignment(assignment)}
                className={buttonDanger}
              >
                Hapus
              </button>
            </li>
          ))
        )}
      </ul>

      {showAdd ? (
        <div className="mt-3 space-y-3 rounded-md border border-wood/15 bg-parchment/30 p-3">
          <PersonPicker label="Cari anggota" onPick={assign} busy={busy} />
          <label className="block">
            <span className="text-xs font-medium text-muted">Tanggal mulai</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputCls}
            />
          </label>
          <button type="button" disabled={busy} onClick={() => setShowAdd(false)} className={buttonGhost}>
            Tutup
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => setShowAdd(true)}
          className="mt-3 min-h-11 rounded-md border border-forest px-4 py-2 text-sm font-semibold text-forest transition-colors hover:bg-forest/10 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          Tambah pengurus
        </button>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={deletePosition}
        title="Hapus jabatan"
        message={`Jabatan "${position.name}" beserta penugasannya akan dihapus.`}
      />
    </li>
  );
}

function RepresentativeRow({
  branch,
  slot,
  representative,
  onChanged,
}: {
  branch: AdminBranch;
  slot: number;
  representative: AdminRepresentative | null;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [startDate, setStartDate] = useState(todayInput());

  async function assign(person: PersonOption) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/governance/branch-representative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId: branch.id, personId: person.id, slot, startDate }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Gagal menetapkan perwakilan");
      toast("success", `${person.fullName} ditetapkan sebagai perwakilan ${branch.name}.`);
      setPicking(false);
      onChanged();
    } catch (error) {
      toast("error", (error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!representative) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/governance/branch-representative?id=${encodeURIComponent(representative.id)}`,
        { method: "DELETE" },
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Gagal menghapus perwakilan");
      toast("success", "Perwakilan dihapus.");
      onChanged();
    } catch (error) {
      toast("error", (error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-wood/15 bg-parchment/20 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        Perwakilan {slot}
      </p>
      {representative ? (
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-forest">
            {representative.person.fullName}
          </span>
          <button type="button" disabled={busy} onClick={remove} className={buttonDanger}>
            Hapus
          </button>
        </div>
      ) : picking ? (
        <div className="mt-2 space-y-2">
          <PersonPicker label="Cari anggota cabang ini" onPick={assign} busy={busy} />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={inputCls}
            aria-label="Tanggal mulai perwakilan"
          />
          <button type="button" disabled={busy} onClick={() => setPicking(false)} className={buttonGhost}>
            Batal
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => setPicking(true)}
          className="mt-1 min-h-11 rounded-md border border-forest px-3 py-2 text-xs font-semibold text-forest transition-colors hover:bg-forest/10 disabled:opacity-50"
        >
          Tetapkan perwakilan
        </button>
      )}
    </div>
  );
}

/** Header struktur aktif dengan mode edit yang dikelola sendiri. */
function StructureHeader({
  structure,
  onSaved,
}: {
  structure: AdminStructure;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(structure.name);
  const [description, setDescription] = useState(structure.description ?? "");

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/governance/structure", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: structure.id, name, description }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Gagal memperbarui struktur");
      toast("success", "Struktur diperbarui.");
      setEditing(false);
      onSaved();
    } catch (error) {
      toast("error", (error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-gold/40 bg-gold/10 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {editing ? (
            <div className="grid gap-3">
              <label className="block">
                <span className="text-xs font-medium text-muted">Nama struktur</span>
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted">Deskripsi</span>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={inputCls}
                />
              </label>
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={save} className={buttonPrimary}>
                  Simpan
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setEditing(false)}
                  className={buttonGhost}
                >
                  Batal
                </button>
              </div>
            </div>
          ) : (
            <>
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  structure.isActive ? "bg-forest/10 text-forest" : "bg-wood/10 text-wood"
                }`}
              >
                {structure.isActive ? "Aktif" : "Nonaktif"}
              </span>
              <h2 className="mt-2 font-display text-xl font-semibold text-forest">
                {structure.name}
              </h2>
              {structure.description && (
                <p className="mt-1 text-sm text-muted">{structure.description}</p>
              )}
            </>
          )}
        </div>
        {!editing && (
          <button type="button" disabled={busy} onClick={() => setEditing(true)} className={buttonGhost}>
            Edit struktur
          </button>
        )}
      </div>
    </section>
  );
}

export function PengurusAdmin({
  structures,
  branches,
  representatives,
}: {
  structures: AdminStructure[];
  branches: AdminBranch[];
  representatives: AdminRepresentative[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [newPositionName, setNewPositionName] = useState("");
  const [newPositionLevel, setNewPositionLevel] = useState("4");
  const [newPositionDescription, setNewPositionDescription] = useState("");

  const activeStructure = useMemo(
    () => structures.find((s) => s.isActive) ?? structures[0] ?? null,
    [structures],
  );

  const reload = useCallback(() => router.refresh(), [router]);

  async function createSetup() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/governance/setup", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Gagal membuat struktur");
      toast("success", "Struktur kepengurusan dan jabatan bawaan dibuat.");
      reload();
    } catch (error) {
      toast("error", (error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function createPosition() {
    if (!activeStructure) return;
    if (!newPositionName.trim()) {
      toast("error", "Nama jabatan wajib diisi.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/governance/position", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          structureId: activeStructure.id,
          name: newPositionName,
          description: newPositionDescription,
          level: Number(newPositionLevel) || 0,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Gagal menambah jabatan");
      toast("success", "Jabatan ditambahkan.");
      setNewPositionName("");
      setNewPositionDescription("");
      reload();
    } catch (error) {
      toast("error", (error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!activeStructure) {
    return (
      <div className="max-w-2xl rounded-lg border border-dashed border-wood/30 bg-parchment/40 p-6">
        <h2 className="font-display text-lg font-semibold text-forest">
          Belum ada struktur kepengurusan
        </h2>
        <p className="mt-2 text-sm text-muted">
          Buat struktur awal beserta jabatan bawaannya (dewan pertimbangan,
          ketua, sekretaris, bendahara, dan bidang-bidang) dalam satu langkah.
          Setelah itu Anda dapat menetapkan nama pengurus pada tiap jabatan.
        </p>
        <button type="button" disabled={busy} onClick={createSetup} className={`mt-4 ${buttonPrimary}`}>
          Buat struktur kepengurusan
        </button>
      </div>
    );
  }

  const sortedPositions = [...activeStructure.positions].sort(
    (a, b) => a.level - b.level || a.name.localeCompare(b.name),
  );

  return (
    <div className="space-y-8">
      <StructureHeader structure={activeStructure} onSaved={reload} />

      <section>
        <h2 className="font-display text-lg font-semibold text-forest">Jabatan</h2>
        <p className="mt-1 text-sm text-muted">
          Susun jabatan dari tingkat atas ke bawah. Tingkat kecil tampil lebih
          dulu di halaman publik.
        </p>
        <ul className="mt-4 space-y-4">
          {sortedPositions.map((position) => (
            <PositionCard key={position.id} position={position} onChanged={reload} />
          ))}
        </ul>

        <div className="mt-4 rounded-lg border border-wood/15 bg-cream p-4">
          <h3 className="font-display text-base font-semibold text-forest">
            Tambah jabatan
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-muted">Nama jabatan</span>
              <input
                value={newPositionName}
                onChange={(e) => setNewPositionName(e.target.value)}
                placeholder="mis. Koordinator Acara"
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted">Tingkat</span>
              <input
                type="number"
                value={newPositionLevel}
                onChange={(e) => setNewPositionLevel(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-muted">Deskripsi</span>
              <input
                value={newPositionDescription}
                onChange={(e) => setNewPositionDescription(e.target.value)}
                className={inputCls}
              />
            </label>
          </div>
          <button type="button" disabled={busy} onClick={createPosition} className={`mt-3 ${buttonPrimary}`}>
            Tambah jabatan
          </button>
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-forest">
          Dewan Perwakilan Keluarga Cabang
        </h2>
        <p className="mt-1 text-sm text-muted">
          Setiap keluarga cabang memiliki dua slot perwakilan.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((branch) => (
            <div key={branch.id} className="rounded-lg border border-wood/20 bg-cream p-4">
              <h3 className="mb-3 font-display text-sm font-semibold text-forest">
                Cabang {branch.branchNumber}: {branch.name}
              </h3>
              <div className="space-y-2">
                {[1, 2].map((slot) => (
                  <RepresentativeRow
                    key={slot}
                    branch={branch}
                    slot={slot}
                    representative={
                      representatives.find(
                        (r) => r.branchId === branch.id && r.slot === slot,
                      ) ?? null
                    }
                    onChanged={reload}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toast";
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/upload";

type PersonOption = { id: string; fullName: string };
type UserOption = { id: string; email: string; role: string; person: { fullName: string } };

type BranchDetail = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  coverImageUrl: string | null;
  orderIndex: number;
  isActive: boolean;
  rootPerson: PersonOption | null;
  admin: UserOption | null;
  _count: { members: number };
};

const inputCls =
  "mt-1 block w-full rounded-md border border-wood/30 bg-cream px-4 py-2.5 text-sm text-forest placeholder:text-muted/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30";
const labelCls = "block text-sm font-medium text-forest";

export function CabangDetail({ branch }: { branch: BranchDetail }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(branch.name);
  const [description, setDescription] = useState(branch.description ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(branch.coverImageUrl);
  const [orderIndex, setOrderIndex] = useState(branch.orderIndex);
  const [isActive, setIsActive] = useState(branch.isActive);

  const [rootPerson, setRootPerson] = useState<PersonOption | null>(branch.rootPerson);
  const [rootQuery, setRootQuery] = useState("");
  const [rootResults, setRootResults] = useState<PersonOption[]>([]);
  const [searchingRoot, setSearchingRoot] = useState(false);

  const [admin, setAdmin] = useState<UserOption | null>(branch.admin);
  const [adminQuery, setAdminQuery] = useState("");
  const [adminResults, setAdminResults] = useState<UserOption[]>([]);
  const [searchingAdmin, setSearchingAdmin] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function searchRootPersons() {
    if (rootQuery.trim().length < 2) {
      setRootResults([]);
      return;
    }
    setSearchingRoot(true);
    try {
      const res = await fetch(`/api/admin/cari-orang?q=${encodeURIComponent(rootQuery)}`);
      const data = await res.json();
      setRootResults(Array.isArray(data) ? (data as PersonOption[]) : []);
    } catch {
      setRootResults([]);
    } finally {
      setSearchingRoot(false);
    }
  }

  async function searchAdminUsers() {
    if (adminQuery.trim().length < 2) {
      setAdminResults([]);
      return;
    }
    setSearchingAdmin(true);
    try {
      const res = await fetch(`/api/admin/cari-user?q=${encodeURIComponent(adminQuery)}`);
      const data = await res.json();
      setAdminResults(Array.isArray(data) ? (data as UserOption[]) : []);
    } catch {
      setAdminResults([]);
    } finally {
      setSearchingAdmin(false);
    }
  }

  async function uploadCover(file: File | null) {
    if (!file) return;
    setError(null);
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("Ukuran foto maksimal 5MB.");
      return;
    }
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setError("Format foto harus JPG, PNG, atau WebP.");
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/media", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Gagal mengunggah foto");
      setCoverImageUrl((data as { url: string }).url);
      toast("success", "Sampul berhasil diunggah.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengunggah foto");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Nama cabang wajib diisi.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/cabang", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: branch.id,
          name: name.trim(),
          description: description.trim() || null,
          coverImageUrl: coverImageUrl || null,
          orderIndex,
          isActive,
          rootPersonId: rootPerson?.id ?? null,
          adminId: admin?.id ?? null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Gagal menyimpan cabang");

      toast("success", "Cabang berhasil diperbarui.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan cabang");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    const newActive = !isActive;
    try {
      const res = await fetch("/api/admin/cabang", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: branch.id, isActive: newActive }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? "Gagal mengubah status");
      }
      setIsActive(newActive);
      toast("success", newActive ? "Cabang diaktifkan." : "Cabang dinonaktifkan.");
      router.refresh();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Gagal mengubah status");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-8">
      {/* Status toggle */}
      <div className="flex items-center justify-between rounded-md border border-wood/20 bg-parchment/40 p-4">
        <div>
          <p className="text-sm font-medium text-forest">Status Cabang</p>
          <p className="text-xs text-muted">
            {isActive ? "Cabang aktif dan ditampilkan" : "Cabang tidak aktif"}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleActive}
          className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
            isActive
              ? "bg-wood/10 text-wood hover:bg-wood/20"
              : "bg-forest text-cream hover:bg-forest-soft"
          }`}
        >
          {isActive ? "Nonaktifkan" : "Aktifkan"}
        </button>
      </div>

      {/* Name & Description */}
      <div>
        <label htmlFor="name" className={labelCls}>Nama Cabang</label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="description" className={labelCls}>Deskripsi</label>
        <textarea
          id="description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={inputCls}
          placeholder="Deskripsi cabang (opsional)"
        />
      </div>

      {/* Cover photo */}
      <div>
        <span className={labelCls}>Foto Sampul</span>
        <div className="mt-1 flex items-center gap-4">
          {coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverImageUrl}
              alt="Sampul cabang"
              className="h-32 w-48 rounded-md border border-wood/20 object-cover"
            />
          ) : (
            <div className="grid h-32 w-48 place-items-center rounded-md border border-dashed border-wood/30 bg-parchment/40 text-xs text-muted">
              Belum ada
            </div>
          )}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="block rounded-md bg-forest px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft disabled:opacity-50"
            >
              {uploading ? "Mengunggah..." : coverImageUrl ? "Ganti Sampul" : "Unggah Sampul"}
            </button>
            {coverImageUrl && (
              <button
                type="button"
                onClick={() => setCoverImageUrl(null)}
                className="block rounded-md border border-wood/30 px-4 py-2 text-sm text-muted transition-colors hover:bg-wood/10"
              >
                Hapus
              </button>
            )}
            <p className="text-xs text-muted">JPG, PNG, atau WebP. Maksimal 5MB.</p>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          className="sr-only"
          onChange={(e) => uploadCover(e.target.files?.[0] ?? null)}
        />
      </div>

      {/* Order index */}
      <div>
        <label htmlFor="orderIndex" className={labelCls}>Urutan</label>
        <input
          id="orderIndex"
          type="number"
          min="0"
          value={orderIndex}
          onChange={(e) => setOrderIndex(parseInt(e.target.value) || 0)}
          className={`${inputCls} w-32`}
        />
      </div>

      {/* Root person search */}
      <div>
        <span className={labelCls}>Akar Cabang (Root Person)</span>
        {rootPerson ? (
          <div className="mt-1 flex items-center justify-between gap-3 rounded-md border border-wood/30 bg-parchment/40 px-4 py-2.5">
            <span className="text-sm font-medium text-forest">{rootPerson.fullName}</span>
            <button
              type="button"
              onClick={() => {
                setRootPerson(null);
                setRootQuery("");
                setRootResults([]);
              }}
              className="text-xs text-muted underline hover:text-wood"
            >
              Hapus
            </button>
          </div>
        ) : (
          <div>
            <input
              type="search"
              value={rootQuery}
              onChange={(e) => setRootQuery(e.target.value)}
              onBlur={searchRootPersons}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  searchRootPersons();
                }
              }}
              placeholder="Ketik minimal 2 huruf..."
              aria-label="Cari anggota untuk dijadikan akar cabang"
              className={inputCls}
            />
            {searchingRoot && <p className="mt-1 text-xs text-muted">Mencari...</p>}
            {!searchingRoot && rootQuery.trim().length >= 2 && rootResults.length === 0 && (
              <p className="mt-1 text-xs text-muted">Tidak ada anggota yang cocok.</p>
            )}
            {rootResults.length > 0 && (
              <ul className="mt-1 max-h-56 overflow-y-auto rounded-md border border-wood/25 bg-cream">
                {rootResults.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setRootPerson(p);
                        setRootResults([]);
                        setRootQuery("");
                      }}
                      className="block w-full px-4 py-2.5 text-left text-sm text-forest transition-colors hover:bg-wood/10"
                    >
                      {p.fullName}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Admin search */}
      <div>
        <span className={labelCls}>Admin Cabang</span>
        {admin ? (
          <div className="mt-1 flex items-center justify-between gap-3 rounded-md border border-wood/30 bg-parchment/40 px-4 py-2.5">
            <div>
              <span className="text-sm font-medium text-forest">{admin.person.fullName}</span>
              <span className="ml-2 text-xs text-muted">({admin.email})</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setAdmin(null);
                setAdminQuery("");
                setAdminResults([]);
              }}
              className="text-xs text-muted underline hover:text-wood"
            >
              Hapus
            </button>
          </div>
        ) : (
          <div>
            <input
              type="search"
              value={adminQuery}
              onChange={(e) => setAdminQuery(e.target.value)}
              onBlur={searchAdminUsers}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  searchAdminUsers();
                }
              }}
              placeholder="Ketik minimal 2 huruf..."
              aria-label="Cari pengguna untuk dijadikan admin cabang"
              className={inputCls}
            />
            {searchingAdmin && <p className="mt-1 text-xs text-muted">Mencari...</p>}
            {!searchingAdmin && adminQuery.trim().length >= 2 && adminResults.length === 0 && (
              <p className="mt-1 text-xs text-muted">Tidak ada pengguna yang cocok.</p>
            )}
            {adminResults.length > 0 && (
              <ul className="mt-1 max-h-56 overflow-y-auto rounded-md border border-wood/25 bg-cream">
                {adminResults.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setAdmin(u);
                        setAdminResults([]);
                        setAdminQuery("");
                      }}
                      className="block w-full px-4 py-2.5 text-left text-sm text-forest transition-colors hover:bg-wood/10"
                    >
                      {u.person.fullName}
                      <span className="ml-2 text-xs text-muted">({u.email} — {u.role})</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-wood/10 p-3 text-sm text-wood">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-gold px-5 py-2.5 text-sm font-semibold text-forest transition-colors hover:bg-gold-deep disabled:opacity-50"
        >
          {saving ? "Menyimpan..." : "Simpan Perubahan"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/cabang")}
          className="rounded-md border border-wood/30 px-5 py-2.5 text-sm text-muted transition-colors hover:bg-wood/10"
        >
          Kembali
        </button>
      </div>
    </form>
  );
}
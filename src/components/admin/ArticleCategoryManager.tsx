"use client";

import { useState } from "react";
import { toast } from "@/components/ui/Toast";

type Kategori = {
  id: string;
  name: string;
  slug: string;
  _count: { articles: number };
};

/**
 * Manajer CRUD kategori artikel untuk Super Admin.
 * Dipakai di halaman /admin/artikel/kategori.
 */
export function ArticleCategoryManager({
  initial,
}: {
  initial: Kategori[];
}) {
  const [categories, setCategories] = useState(initial);
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!newName.trim()) {
      setError("Nama kategori wajib diisi.");
      return;
    }
    setError(null);
    setAdding(true);

    try {
      const res = await fetch("/api/admin/artikel/kategori", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Gagal menambah kategori");

      toast("success", "Kategori ditambahkan.");
      setNewName("");
      setCategories((prev) => [
        ...prev,
        {
          id: (data as { id: string }).id,
          name: newName.trim(),
          slug: (data as { slug: string }).slug,
          _count: { articles: 0 },
        },
      ]);
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Gagal menambah kategori");
    } finally {
      setAdding(false);
    }
  }

  async function handleUpdate(id: string) {
    if (!editName.trim()) {
      setError("Nama kategori wajib diisi.");
      return;
    }
    setError(null);
    setSaving(true);

    try {
      const res = await fetch("/api/admin/artikel/kategori", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: editName.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Gagal memperbarui kategori");

      toast("success", "Kategori diperbarui.");
      setCategories((prev) =>
        prev.map((c) => (c.id === id ? { ...c, name: editName.trim(), slug: (data as { slug: string }).slug } : c))
      );
      setEditId(null);
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Gagal memperbarui kategori");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(kategori: Kategori) {
    if (kategori._count.articles > 0) {
      toast("error", "Kategori tidak bisa dihapus karena masih digunakan oleh artikel.");
      return;
    }
    if (!confirm(`Hapus kategori "${kategori.name}"?`)) return;

    try {
      const res = await fetch(`/api/admin/artikel/kategori?id=${encodeURIComponent(kategori.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Gagal menghapus kategori");
      }

      toast("success", "Kategori dihapus.");
      setCategories((prev) => prev.filter((c) => c.id !== kategori.id));
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Gagal menghapus kategori");
    }
  }

  return (
    <div>
      {error && (
        <p role="alert" className="mb-4 rounded-md bg-wood/10 p-3 text-sm text-wood">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="Nama kategori baru"
          aria-label="Nama kategori baru"
          className="rounded-md border border-wood/30 bg-cream px-4 py-2.5 text-sm text-forest placeholder:text-muted/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={adding || !newName.trim()}
          className="rounded-md bg-forest px-4 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft disabled:opacity-50"
        >
          {adding ? "Menambah..." : "Tambah"}
        </button>
      </div>

      {categories.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-wood/25 bg-cream px-4 py-6 text-center text-sm text-muted">
          Belum ada kategori. Tambahkan yang pertama.
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {categories.map((k) => (
            <li
              key={k.id}
              className="flex items-center gap-3 rounded-lg border border-wood/15 bg-cream p-3"
            >
              {editId === k.id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleUpdate(k.id);
                      }
                      if (e.key === "Escape") setEditId(null);
                    }}
                    autoFocus
                    aria-label="Nama kategori"
                    className="flex-1 rounded-md border border-wood/30 bg-cream px-3 py-2 text-sm text-forest focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
                  />
                  <button
                    type="button"
                    onClick={() => handleUpdate(k.id)}
                    disabled={saving}
                    className="rounded-md bg-forest px-3 py-2 text-xs font-semibold text-cream hover:bg-forest-soft disabled:opacity-50"
                  >
                    Simpan
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditId(null)}
                    className="rounded-md border border-wood/30 px-3 py-2 text-xs text-muted hover:bg-wood/10"
                  >
                    Batal
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 font-medium text-forest">{k.name}</span>
                  <span className="text-xs text-muted">{k._count.articles} artikel</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditId(k.id);
                      setEditName(k.name);
                      setError(null);
                    }}
                    className="rounded-md px-2 py-1 text-xs font-medium text-gold-deep underline hover:text-forest"
                  >
                    Ubah
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(k)}
                    className="rounded-md px-2 py-1 text-xs font-medium text-wood underline hover:text-wood-soft"
                  >
                    Hapus
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
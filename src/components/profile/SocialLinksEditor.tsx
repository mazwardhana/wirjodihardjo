"use client";

import { useState } from "react";
import { buttonClass, controlClass, useProfileCollection } from "./editor-shared";

type SocialLink = { id: string; url: string; username: string | null; platform: { id: string; name: string } };
type Platform = { id: string; name: string };
const empty = { platformId: "", url: "", username: "" };

export function SocialLinksEditor({ platforms, onChanged, onBusy }: { platforms: Platform[]; onChanged: () => void; onBusy: (busy: boolean) => void }) {
  const { items, loading, error, busy, notice, load, mutate } = useProfileCollection<SocialLink>("social", onChanged, onBusy);
  const [editing, setEditing] = useState<SocialLink | null>(null);
  const [form, setForm] = useState(empty);
  function reset() { setEditing(null); setForm(empty); }

  return <section className="space-y-5">
    <p className="text-sm text-muted">Tombol tambah, perbarui, dan hapus langsung menyimpan perubahan. Tautan tanpa pengaturan visibilitas publik tidak ditampilkan di profil publik.</p>
    {!platforms.length && <p role="status">Belum ada platform tersedia. Hubungi pengelola keluarga.</p>}
    {loading && <p role="status">Memuat link sosial media...</p>}
    {error && <div role="alert"><p>{error}</p><button className={buttonClass} type="button" onClick={() => void load()}>Coba muat lagi</button></div>}
    {notice && <p role="status">{notice}</p>}
    {!loading && !error && !items.length && <p>Belum ada link sosial media.</p>}
    <ul className="space-y-3">{items.map(item => <li key={item.id} className="min-w-0 border-b border-wood/15 pb-3">
      <p className="break-words font-medium">{item.platform.name}</p>
      {item.username && <p className="text-sm">@{item.username}</p>}
      <p className="break-all text-sm">{item.url}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className={buttonClass} disabled={busy} aria-label={`Edit link ${item.platform.name}`} onClick={() => {
          setEditing(item); setForm({ platformId: item.platform.id, url: item.url, username: item.username ?? "" });
        }}>Edit</button>
        <button type="button" className={buttonClass} disabled={busy} aria-label={`Hapus link ${item.platform.name}`} onClick={async () => {
          if (window.confirm(`Hapus link ${item.platform.name}?`) && await mutate("DELETE", item.id)) reset();
        }}>Hapus</button>
      </div>
    </li>)}</ul>
    <form onSubmit={async e => {
      e.preventDefault();
      const body = { ...form };
      if (await mutate(editing ? "PUT" : "POST", editing?.id, body)) reset();
    }}>
      <fieldset disabled={busy || loading || !platforms.length} className="grid min-w-0 gap-4">
        <legend className="mb-3 font-display text-lg">{editing ? "Edit link sosial media" : "Tambah link sosial media"}</legend>
        <label className="min-w-0 text-sm">Platform
          <select className={controlClass} value={form.platformId} required onChange={e => setForm(f => ({ ...f, platformId: e.target.value }))}>
            <option value="">Pilih platform</option>
            {platforms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="min-w-0 text-sm">URL
          <input className={controlClass} type="url" pattern="https?://.*" title="Gunakan URL http atau https" value={form.url} required maxLength={500} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
        </label>
        <label className="min-w-0 text-sm">Username
          <input className={controlClass} value={form.username} maxLength={100} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
        </label>
        <div className="flex flex-wrap gap-2"><button className={buttonClass} type="submit">{busy ? "Menyimpan..." : editing ? "Perbarui link" : "Tambah link"}</button>{editing && <button type="button" className={buttonClass} onClick={reset}>Batal edit link</button>}</div>
      </fieldset>
    </form>
  </section>;
}

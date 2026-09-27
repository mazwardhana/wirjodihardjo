"use client";

import { useState } from "react";
import { buttonClass, controlClass, useProfileCollection } from "./editor-shared";

type Education = { id: string; institution: string; degree: string | null; fieldOfStudy: string | null; startYear: number | null; endYear: number | null; description: string | null };
const empty = { institution: "", degree: "", fieldOfStudy: "", startYear: "", endYear: "", description: "" };
const fields = [
  ["institution", "Institusi"], ["degree", "Gelar"], ["fieldOfStudy", "Bidang studi"],
  ["startYear", "Tahun mulai"], ["endYear", "Tahun selesai"], ["description", "Deskripsi"],
] as const;

export function EducationEditor({ onChanged, onBusy }: { onChanged: () => void; onBusy: (busy: boolean) => void }) {
  const { items, loading, error, busy, notice, load, mutate } = useProfileCollection<Education>("education", onChanged, onBusy);
  const [editing, setEditing] = useState<Education | null>(null);
  const [form, setForm] = useState(empty);
  function reset() { setEditing(null); setForm(empty); }
  return <section className="space-y-5">
    <p className="text-sm text-muted">Pendidikan tampil di profil publik. Tombol tambah, perbarui, dan hapus langsung menyimpan perubahan.</p>
    {loading && <p role="status">Memuat pendidikan...</p>}
    {error && <div role="alert"><p>{error}</p><button className={buttonClass} type="button" onClick={() => void load()}>Coba muat lagi</button></div>}
    {notice && <p role="status">{notice}</p>}
    {!loading && !error && !items.length && <p>Belum ada data pendidikan.</p>}
    <ul className="space-y-3">{items.map(item => <li key={item.id} className="min-w-0 border-b border-wood/15 pb-3">
      <p className="break-words font-medium">{item.institution}</p><p className="text-sm">{[item.degree, item.fieldOfStudy].filter(Boolean).join(" · ")}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className={buttonClass} disabled={busy} aria-label={`Edit pendidikan ${item.institution}`} onClick={() => {
          setEditing(item); setForm({ institution: item.institution, degree: item.degree ?? "", fieldOfStudy: item.fieldOfStudy ?? "", startYear: item.startYear?.toString() ?? "", endYear: item.endYear?.toString() ?? "", description: item.description ?? "" });
        }}>Edit</button>
        <button type="button" className={buttonClass} disabled={busy} aria-label={`Hapus pendidikan ${item.institution}`} onClick={async () => {
          if (window.confirm(`Hapus pendidikan ${item.institution}?`) && await mutate("DELETE", item.id)) reset();
        }}>Hapus</button>
      </div>
    </li>)}</ul>
    <form onSubmit={async e => {
      e.preventDefault();
      const body = { ...form, startYear: form.startYear ? Number(form.startYear) : undefined, endYear: form.endYear ? Number(form.endYear) : undefined };
      if (await mutate(editing ? "PUT" : "POST", editing?.id, body)) reset();
    }}>
      <fieldset disabled={busy || loading} className="grid min-w-0 gap-4 sm:grid-cols-2">
        <legend className="mb-3 font-display text-lg">{editing ? "Edit pendidikan" : "Tambah pendidikan"}</legend>
        {fields.map(([key, label]) => <label key={key} className="min-w-0 text-sm">{label}
          <input className={controlClass} value={form[key]} maxLength={key === "description" ? 1000 : 200}
            type={key.endsWith("Year") ? "number" : "text"} min={key.endsWith("Year") ? (key === "endYear" && form.startYear ? Number(form.startYear) : 1900) : undefined} max={key.endsWith("Year") ? 2100 : undefined}
            required={key === "institution" || (!!editing && key.endsWith("Year") && editing[key as "startYear" | "endYear"] !== null)}
            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
        </label>)}
        {editing && <p className="text-sm text-muted sm:col-span-2">Tahun yang sudah terisi dapat diganti. Untuk mengosongkannya, hapus lalu tambahkan kembali pendidikan ini.</p>}
        <div className="flex flex-wrap gap-2 sm:col-span-2"><button className={buttonClass} type="submit">{busy ? "Menyimpan..." : editing ? "Perbarui pendidikan" : "Tambah pendidikan"}</button>{editing && <button type="button" className={buttonClass} onClick={reset}>Batal edit pendidikan</button>}</div>
      </fieldset>
    </form>
  </section>;
}

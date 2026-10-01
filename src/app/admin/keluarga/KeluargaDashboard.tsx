"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { calculateAge, normalizeWhatsApp } from "@/lib/profile";
import { FamilyTreeModal } from "@/components/keluarga/FamilyTreeModal";
import { MemberDetailModal } from "@/components/keluarga/MemberDetailModal";
import { MemberEditModal } from "./MemberEditModal";

export type BranchOption = { id: string; name: string; branchNumber: number };

type KeluargaStats = {
  total: number;
  alive: number;
  deceased: number;
  unassigned: number;
  male: number;
  female: number;
  generationLevels: number[];
};

type KeluargaBranchInfo = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  branchNumber: number;
  adminName: string | null;
  rootPersonName: string | null;
  memberCount: number;
};

type KeluargaMember = {
  id: string;
  fullName: string;
  nickname: string | null;
  gender: string;
  birthDate: string | null;
  deathDate: string | null;
  birthPlace: string | null;
  isDeceased: boolean;
  generationLevel: number | null;
  city: string | null;
  phone: string | null;
  whatsapp: string | null;
  addressLine: string | null;
};

type StatsResponse = { branchId: string; branch: KeluargaBranchInfo | null; stats: KeluargaStats };
type MembersResponse = { branchId: string; members: KeluargaMember[] };

const selectCls =
  "min-h-11 rounded-md border border-wood/30 bg-cream px-3 py-2 text-sm text-forest focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/30";

function usiaText(member: KeluargaMember): string {
  if (member.isDeceased) {
    if (member.birthDate && member.deathDate) {
      const age = calculateAge(new Date(member.birthDate), new Date(member.deathDate));
      if (age !== null) return `Wafat (usia ${age})`;
    }
    return "Wafat";
  }
  if (!member.birthDate) return "-";
  const age = calculateAge(new Date(member.birthDate));
  return age === null ? "-" : `${age} tahun`;
}

function generasiText(member: KeluargaMember): string {
  return member.generationLevel === null ? "Belum di-assign" : `Generasi ${member.generationLevel}`;
}

function phoneNumber(member: KeluargaMember): string | null {
  const raw = member.whatsapp || member.phone;
  if (!raw) return null;
  return normalizeWhatsApp(raw);
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function PhoneIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
    </svg>
  );
}

export function KeluargaDashboard({
  isSuperAdmin,
  initialBranchId,
  branchOptions,
}: {
  isSuperAdmin: boolean;
  initialBranchId: string;
  branchOptions: BranchOption[];
}) {
  const [branchId, setBranchId] = useState(initialBranchId);
  const [stats, setStats] = useState<KeluargaStats | null>(null);
  const [branch, setBranch] = useState<KeluargaBranchInfo | null>(null);
  const [members, setMembers] = useState<KeluargaMember[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [gender, setGender] = useState("");
  const [generation, setGeneration] = useState("");
  const [status, setStatus] = useState("");

  const [detailPersonId, setDetailPersonId] = useState<string | null>(null);
  const [familyTreeMember, setFamilyTreeMember] = useState<KeluargaMember | null>(null);
  const [editMember, setEditMember] = useState<KeluargaMember | null>(null);

  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setQ(searchInput.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const memberParams = new URLSearchParams({ branchId });
        if (gender) memberParams.set("gender", gender);
        if (generation) memberParams.set("generation", generation);
        if (status) memberParams.set("status", status);
        if (q) memberParams.set("q", q);

        const [statsRes, membersRes] = await Promise.all([
          fetch(`/api/admin/keluarga/stats?branchId=${encodeURIComponent(branchId)}`, {
            signal: controller.signal,
          }),
          fetch(`/api/admin/keluarga/members?${memberParams.toString()}`, {
            signal: controller.signal,
          }),
        ]);

        if (!statsRes.ok) {
          const body = (await statsRes.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Gagal memuat statistik keluarga cabang");
        }
        if (!membersRes.ok) {
          const body = (await membersRes.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Gagal memuat daftar anggota");
        }

        const statsData = (await statsRes.json()) as StatsResponse;
        const membersData = (await membersRes.json()) as MembersResponse;
        setStats(statsData.stats);
        setBranch(statsData.branch);
        setMembers(membersData.members);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Gagal memuat data keluarga");
        setMembers([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [branchId, gender, generation, status, q, reloadKey]);

  function focusUnassigned() {
    setGeneration("unassigned");
    requestAnimationFrame(() => {
      tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function exportCsv() {
    if (!members || members.length === 0) return;
    const header = ["Nickname", "Nama Lengkap", "Usia", "Kota Domisili", "Generasi", "Nomor Telepon"];
    const rows = members.map((m) => [
      m.nickname ?? "",
      m.fullName,
      usiaText(m),
      m.city ?? "",
      generasiText(m),
      m.phone ?? m.whatsapp ?? "",
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `anggota-keluarga-${branch?.slug ?? "keluarga-cabang"}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const hasFilters = Boolean(searchInput || gender || generation || status);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-forest">Keluarga</h1>
          <p className="mt-1 text-sm text-muted">
            Dashboard anggota per keluarga cabang beserta status pohon keluarganya.
          </p>
        </div>

        {isSuperAdmin && (
          <label className="flex items-center gap-2 text-sm text-muted">
            <span>Keluarga Cabang</span>
            <select
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
              aria-label="Pilih keluarga cabang"
              className={selectCls}
            >
              {branchOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  Keluarga Cabang {option.branchNumber} - {option.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-md bg-wood/10 p-3 text-sm text-wood">
          {error}
        </p>
      )}

      {/* Info keluarga cabang (nama, admin, akar, jumlah) hidup di /admin/keluarga/cabang; di sini cukup pointer. */}
      {isSuperAdmin && (
        <p className="mt-6 text-sm text-muted">
          Info dan pengaturan keluarga cabang ada di{" "}
          <Link href="/admin/keluarga/cabang" className="underline hover:text-forest">
            Kelola Keluarga Cabang
          </Link>
          .
        </p>
      )}

      {/* Baris 4 card */}
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-wood/20 bg-cream p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Total Anggota</p>
          <p className="mt-2 font-display text-3xl font-semibold text-forest">
            {stats?.total ?? "-"}
          </p>
          <p className="mt-2 text-xs text-muted">
            Hidup {stats?.alive ?? "-"} &middot; Wafat {stats?.deceased ?? "-"}
          </p>
        </div>

        <button
          type="button"
          onClick={focusUnassigned}
          aria-pressed={generation === "unassigned"}
          className="min-h-11 rounded-lg border border-wood/20 bg-cream p-5 text-left transition-colors hover:border-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          <p className="text-xs uppercase tracking-wide text-muted">Belum di-assign</p>
          <p className="mt-2 font-display text-3xl font-semibold text-gold-deep">
            {stats?.unassigned ?? "-"}
          </p>
          <p className="mt-2 text-xs text-muted">Klik untuk memfilter tabel</p>
        </button>

        <div className="rounded-lg border border-wood/20 bg-cream p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Laki-laki</p>
          <p className="mt-2 font-display text-3xl font-semibold text-forest">
            {stats?.male ?? "-"}
          </p>
        </div>

        <div className="rounded-lg border border-wood/20 bg-cream p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Perempuan</p>
          <p className="mt-2 font-display text-3xl font-semibold text-forest">
            {stats?.female ?? "-"}
          </p>
        </div>
      </div>

      {/* Card 6: tabel member */}
      <section ref={tableRef} className="mt-6 scroll-mt-6">
        <div className="flex flex-wrap items-center gap-3" role="search" aria-busy={loading}>
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Cari nama atau panggilan..."
            aria-label="Cari nama atau panggilan"
            className="min-h-11 w-full min-w-0 rounded-md border border-wood/30 bg-cream px-4 py-2 text-sm text-forest placeholder:text-muted focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/30 sm:w-72"
          />

          <label className="flex items-center gap-2 text-sm text-muted">
            <span className="sr-only sm:not-sr-only">Jenis kelamin</span>
            <select
              value={gender}
              onChange={(event) => setGender(event.target.value)}
              aria-label="Filter jenis kelamin"
              className={selectCls}
            >
              <option value="">Semua gender</option>
              <option value="male">Laki-laki</option>
              <option value="female">Perempuan</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm text-muted">
            <span className="sr-only sm:not-sr-only">Generasi</span>
            <select
              value={generation}
              onChange={(event) => setGeneration(event.target.value)}
              aria-label="Filter generasi"
              className={selectCls}
            >
              <option value="">Semua generasi</option>
              <option value="unassigned">Belum di-assign</option>
              {(stats?.generationLevels ?? []).map((level) => (
                <option key={level} value={String(level)}>
                  Generasi {level}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm text-muted">
            <span className="sr-only sm:not-sr-only">Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              aria-label="Filter status"
              className={selectCls}
            >
              <option value="">Semua status</option>
              <option value="alive">Hidup</option>
              <option value="deceased">Wafat</option>
            </select>
          </label>

          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setQ("");
                setGender("");
                setGeneration("");
                setStatus("");
              }}
              className="min-h-11 px-2 text-sm text-muted underline hover:text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
            >
              Reset filter
            </button>
          )}

          <Link
            href={`/admin/anggota/tambah?branchId=${branchId}`}
            className="ml-auto min-h-11 rounded-md border border-forest px-4 py-2 text-sm font-semibold text-forest transition-colors hover:bg-forest/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            Tambah Anggota
          </Link>

          <button
            type="button"
            onClick={exportCsv}
            disabled={!members || members.length === 0}
            className="min-h-11 rounded-md bg-forest px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft disabled:opacity-50"
          >
            Unduh CSV
          </button>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-wood/15">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-wood/15 bg-parchment/40 text-xs font-medium uppercase tracking-wide text-muted">
                <th className="px-4 py-3">Nickname</th>
                <th className="px-4 py-3">Nama Lengkap</th>
                <th className="px-4 py-3">Usia</th>
                <th className="px-4 py-3">Kota Domisili</th>
                <th className="px-4 py-3">Generasi</th>
                <th className="px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && !members ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted">
                    Memuat anggota...
                  </td>
                </tr>
              ) : !members || members.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted">
                    Tidak ada anggota yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                members.map((member) => {
                  const wa = phoneNumber(member);
                  return (
                    <tr key={member.id} className="border-b border-wood/10">
                      <td className="px-4 py-3 text-muted">{member.nickname || "-"}</td>
                      <td className="px-4 py-3 font-semibold text-forest">{member.fullName}</td>
                      <td className="px-4 py-3 text-muted">{usiaText(member)}</td>
                      <td className="px-4 py-3 text-muted">{member.city || "-"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <button
                            type="button"
                            onClick={() => setFamilyTreeMember(member)}
                            className="min-h-11 rounded-md border border-gold/50 px-3 py-2 text-xs font-semibold text-gold-deep transition-colors hover:bg-gold/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                          >
                            Pohon Keluarga
                          </button>
                          {member.generationLevel === null ? (
                            <span className="text-xs font-medium text-gold-deep">
                              Belum di-assign
                            </span>
                          ) : (
                            <span className="text-xs text-muted">
                              Generasi {member.generationLevel}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setDetailPersonId(member.id)}
                            className="min-h-11 rounded-md px-3 py-2 text-xs font-medium text-forest transition-colors hover:bg-wood/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                          >
                            Detail
                          </button>
                          {wa ? (
                            <a
                              href={`https://wa.me/${wa}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Kirim WhatsApp ke ${member.fullName}`}
                              className="grid min-h-11 min-w-11 place-items-center rounded-md text-forest transition-colors hover:bg-wood/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                            >
                              <PhoneIcon />
                            </a>
                          ) : (
                            <span
                              aria-disabled="true"
                              title="Nomor telepon tidak tersedia"
                              className="grid min-h-11 min-w-11 place-items-center rounded-md text-muted/40"
                            >
                              <PhoneIcon />
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditMember(member)}
                            className="min-h-11 rounded-md px-3 py-2 text-xs font-medium text-gold-deep transition-colors hover:bg-wood/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {members && members.length > 0 && (
          <p className="mt-3 text-xs text-muted">
            Menampilkan {members.length} anggota sesuai filter.
          </p>
        )}
      </section>

      {detailPersonId && (
        <MemberDetailModal personId={detailPersonId} onClose={() => setDetailPersonId(null)} />
      )}

      {familyTreeMember && (
        <FamilyTreeModal
          personId={familyTreeMember.id}
          branchId={branchId}
          onClose={() => setFamilyTreeMember(null)}
        />
      )}

      {editMember && (
        <MemberEditModal
          personId={editMember.id}
          onClose={() => setEditMember(null)}
          onSaved={() => setReloadKey((key) => key + 1)}
        />
      )}
    </div>
  );
}

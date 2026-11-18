"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Avatar } from "@/components/ui/Avatar";
import { computeKinship, type KinshipContext } from "@/lib/kinship";
import type { PublicPerson } from "@/lib/data";
import type { FamilyTreeData } from "@/components/silsilah/treeLayout";

/**
 * Kalkulator relasi/sapaan kekerabatan antar dua anggota.
 *
 * Berjalan sepenuhnya di client memakai data pohon yang sudah dimuat halaman
 * silsilah (tanpa request tambahan): algoritma LCA + aturan sapaan Indonesia
 * ada di `@/lib/kinship` yang murni.
 */
export function KinshipCalculator({
  data,
  initialPerson,
  open,
  onClose,
}: {
  data: FamilyTreeData;
  /** Orang yang sudah terpilih sebelum dialog dibuka (dari kartu/panel detail). */
  initialPerson?: PublicPerson | null;
  open: boolean;
  onClose: () => void;
}) {
  const sortedPersons = useMemo(
    () =>
      [...data.persons].sort((a, b) =>
        a.fullName.localeCompare(b.fullName, "id"),
      ),
    [data.persons],
  );

  const [aId, setAId] = useState<string>(initialPerson?.id ?? "");
  const [bId, setBId] = useState<string>("");
  // Sinkronkan pilihan A saat dialog dibuka dari kartu orang berbeda.
  const [seededFor, setSeededFor] = useState<string | null>(
    initialPerson?.id ?? null,
  );
  useEffect(() => {
    if (open && initialPerson && initialPerson.id !== seededFor) {
      setSeededFor(initialPerson.id);
      setAId(initialPerson.id);
    }
  }, [open, initialPerson, seededFor]);

  const context = useMemo<KinshipContext>(
    () => ({
      persons: data.persons.map((person) => ({
        id: person.id,
        fullName: person.fullName,
        gender: person.gender,
        birthDate: person.birthDate,
      })),
      parentEdges: data.childEdges.map((edge) => ({
        parentId: edge.parentId,
        childId: edge.childId,
        isStep: edge.isStep,
        isAdopted: edge.isAdopted,
      })),
      partnerEdges: data.partnerEdges.map((edge) => ({
        partnerAId: edge.partnerAId,
        partnerBId: edge.partnerBId,
      })),
    }),
    [data],
  );

  const personA = data.persons.find((p) => p.id === aId) ?? null;
  const personB = data.persons.find((p) => p.id === bId) ?? null;

  const result = useMemo(() => {
    if (!personA || !personB) return null;
    return computeKinship(
      {
        id: personA.id,
        fullName: personA.fullName,
        gender: personA.gender,
        birthDate: personA.birthDate,
      },
      {
        id: personB.id,
        fullName: personB.fullName,
        gender: personB.gender,
        birthDate: personB.birthDate,
      },
      context,
    );
  }, [personA, personB, context]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Kalkulator Relasi"
      description="Pilih dua anggota untuk melihat hubungan kekerabatan dan sapaan yang tepat."
      size="md"
    >
      <div className="space-y-4">
        <div>
          <label
            htmlFor="kinship-person-a"
            className="block text-sm font-medium text-forest"
          >
            Orang pertama
          </label>
          <select
            id="kinship-person-a"
            value={aId}
            onChange={(e) => setAId(e.target.value)}
            className="mt-1 block min-h-11 w-full rounded-md border border-wood/30 bg-cream px-3 py-2 text-base text-forest focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
          >
            <option value="">— pilih anggota —</option>
            {sortedPersons.map((person) => (
              <option key={person.id} value={person.id}>
                {person.fullName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="kinship-person-b"
            className="block text-sm font-medium text-forest"
          >
            Orang kedua
          </label>
          <select
            id="kinship-person-b"
            value={bId}
            onChange={(e) => setBId(e.target.value)}
            className="mt-1 block min-h-11 w-full rounded-md border border-wood/30 bg-cream px-3 py-2 text-base text-forest focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
          >
            <option value="">— pilih anggota —</option>
            {sortedPersons.map((person) => (
              <option key={person.id} value={person.id}>
                {person.fullName}
              </option>
            ))}
          </select>
        </div>

        <div
          role="status"
          aria-live="polite"
          className="rounded-md border border-wood/20 bg-parchment/50 p-4"
        >
          {!personA || !personB ? (
            <p className="text-sm text-muted">
              Pilih dua anggota untuk menghitung hubungan kekerabatan.
            </p>
          ) : personA.id === personB.id ? (
            <p className="text-sm text-muted">
              Pilih dua anggota yang berbeda.
            </p>
          ) : result === null ? (
            <p className="text-sm text-muted">
              Tidak ditemukan hubungan kekerabatan antara{" "}
              <span className="font-semibold text-forest">
                {personA.fullName}
              </span>{" "}
              dan{" "}
              <span className="font-semibold text-forest">
                {personB.fullName}
              </span>{" "}
              dalam data silsilah (kemungkinan dari keluarga berbeda atau
              datanya belum terhubung).
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-base font-semibold text-forest">
                {personA.fullName} adalah{" "}
                <span className="text-gold-deep">{result.label}</span> dari{" "}
                {personB.fullName}.
              </p>
              <p className="text-sm text-muted">{result.description}</p>
              <p className="text-sm text-muted">
                Sebaliknya: {personB.fullName} adalah{" "}
                <span className="font-medium text-forest">
                  {result.reverseLabel}
                </span>{" "}
                dari {personA.fullName}.
              </p>
            </div>
          )}
        </div>

        {/* Pratinjau identitas yang dipilih */}
        <div className="flex items-center justify-between gap-4 text-sm text-muted">
          <SelectedPerson person={personA} side="A" />
          <SelectedPerson person={personB} side="B" />
        </div>

        <p className="text-xs leading-relaxed text-muted">
          Catatan: sapaan memakai istilah Jawa (Pakdhe/Budhe untuk kakak dari
          orang tua, Om/Tante untuk yang lebih muda). Relasi tiri (bukan darah)
          tidak dihitung; anak angkat tetap dianggap kerabat.
        </p>
      </div>
    </Dialog>
  );
}

function SelectedPerson({
  person,
  side,
}: {
  person: PublicPerson | null;
  side: "A" | "B";
}) {
  if (!person) {
    return (
      <p className="flex-1">
        <span className="font-medium">Orang {side}:</span> belum dipilih
      </p>
    );
  }
  return (
    <p className="flex flex-1 items-center gap-2">
      <Avatar name={person.fullName} photoUrl={person.photoUrl} size="sm" />
      <span>
        <span className="font-medium text-forest">{person.fullName}</span>
        <span className="block text-xs">Orang {side}</span>
      </span>
    </p>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Dialog } from "@/components/ui/Dialog";
import { ReactFlow, Background, useNodesState, useEdgesState } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

type RawFamily = {
  person: { id: string; fullName: string; nickname: string | null; photoUrl: string | null; gender: string; generationLevel: number | null; isDeceased: boolean };
  parents: Array<{
    member: { id: string; fullName: string; photoUrl: string | null };
    role: string;
    isStep: boolean;
    isAdopted: boolean;
  }>;
  grandparents: Array<{
    member: { id: string; fullName: string; photoUrl: string | null };
    role: string;
    throughParentId: string;
  }>;
  partners: Array<{
    member: { id: string; fullName: string; photoUrl: string | null };
    status: string;
    orderIndex: number;
    marriageDate: string | null;
    divorceDate: string | null;
  }>;
  children: Array<{
    member: { id: string; fullName: string; photoUrl: string | null; gender: string };
    isStep: boolean;
    isAdopted: boolean;
  }>;
  siblings: Array<{
    type: string;
    label: string;
    description: string;
    members: Array<{ id: string; fullName: string; photoUrl: string | null; gender: string }>;
  }>;
};

/**
 * Panel keluarga terdekat yang muncul inline di halaman profil.
 * Ditampilkan sebagai kartu-kartu peran (orang tua, pasangan, saudara, anak).
 * Tombol "Bagan keluarga" membuka modal 2-hop.
 */
export function FamilyPanel({ data }: { data: RawFamily }) {
  const [showGraph, setShowGraph] = useState(false);
  const [depth, setDepth] = useState(1);

  if (!data) return null;

  const { person, parents, grandparents, partners, children, siblings } = data;

  return (
    <div className="rounded-lg border border-wood/15 bg-cream p-5">
      <h2 className="font-display text-lg font-semibold text-forest">Keluarga Terdekat</h2>

      <div className="mt-4 space-y-4">
        {/* Kakek-nenek */}
        {grandparents.length > 0 && (
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted">Kakek-Nenek</h3>
            <div className="mt-1.5 flex flex-wrap gap-3">
              {grandparents.map((gp) => {
                const parentName = parents.find((p) => p.member.id === gp.throughParentId)?.member.fullName;
                return (
                  <Link key={gp.member.id} href={`/profil/${gp.member.id}`} className="flex items-center gap-2 text-sm text-forest hover:text-gold-deep">
                    <Avatar name={gp.member.fullName} photoUrl={gp.member.photoUrl} size="sm" />
                    <div>
                      <span className="font-medium">{gp.member.fullName}</span>
                      {parentName && (
                        <span className="ml-1 text-xs text-muted">
                          (orang tua {parentName})
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Orang tua */}
        {parents.length > 0 && (
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted">Orang tua</h3>
            <div className="mt-1.5 flex flex-wrap gap-3">
              {parents.map((p) => (
                <Link key={p.member.id} href={`/profil/${p.member.id}`} className="flex items-center gap-2 text-sm text-forest hover:text-gold-deep">
                  <Avatar name={p.member.fullName} photoUrl={p.member.photoUrl} size="sm" />
                  <div>
                    <span className="font-medium">{p.member.fullName}</span>
                    <span className="ml-1 text-xs text-muted">
                      ({p.role === "FATHER" ? "Bapak" : p.role === "MOTHER" ? "Ibu" : "Wali"}
                      {p.isStep && ", tiri"})
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Pasangan */}
        {partners.length > 0 && (
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted">Pasangan</h3>
            <div className="mt-1.5 flex flex-wrap gap-3">
              {partners.map((p) => (
                <Link key={p.member.id + p.orderIndex} href={`/profil/${p.member.id}`} className="flex items-center gap-2 text-sm text-forest hover:text-gold-deep">
                  <Avatar name={p.member.fullName} photoUrl={p.member.photoUrl} size="sm" />
                  <div>
                    <span className="font-medium">{p.member.fullName}</span>
                    <span className="ml-1 text-xs text-muted">
                      ({p.status === "MARRIED" ? "Bojo / Garwa" : p.status === "DIVORCED" ? "Mantan" : p.status === "WIDOWED" ? "Alm./Almh." : ""}
                      {partners.length > 1 && ` ke-${p.orderIndex + 1}`})
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Saudara */}
        {siblings.length > 0 && siblings.map((group) => (
          <div key={group.type}>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
              {group.label}
              <span className="ml-1 cursor-help text-[10px]" title={group.description}>ⓘ</span>
            </h3>
            <div className="mt-1.5 flex flex-wrap gap-3">
              {group.members.map((sib) => (
                <Link key={sib.id} href={`/profil/${sib.id}`} className="flex items-center gap-2 text-sm text-forest hover:text-gold-deep">
                  <Avatar name={sib.fullName} photoUrl={sib.photoUrl} size="sm" />
                  <span className="font-medium">{sib.fullName}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}

        {/* Anak */}
        {children.length > 0 && (
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
              Anak
              {children.some((c) => c.isStep) && <span className="ml-1 text-[10px]">(termasuk tiri)</span>}
            </h3>
            <div className="mt-1.5 flex flex-wrap gap-3">
              {children.map((c) => (
                <Link key={c.member.id} href={`/profil/${c.member.id}`} className="flex items-center gap-2 text-sm text-forest hover:text-gold-deep">
                  <Avatar name={c.member.fullName} photoUrl={c.member.photoUrl} size="sm" />
                  <div>
                    <span className="font-medium">{c.member.fullName}</span>
                    {c.isStep && <span className="ml-1 text-xs text-muted">(tiri)</span>}
                    {c.isAdopted && <span className="ml-1 text-xs text-muted">(angkat)</span>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowGraph(true)}
        className="mt-5 w-full rounded-md border border-wood/20 px-4 py-2 text-sm font-medium text-forest transition-colors hover:bg-parchment/60"
      >
        Lihat bagan keluarga
      </button>

      {showGraph && (
        <Dialog open={showGraph} onClose={() => setShowGraph(false)} title="Bagan Keluarga">
          <p className="mb-4 text-sm text-muted">
            <button
              type="button"
              onClick={() => setDepth(depth === 1 ? 2 : 1)}
              className="font-medium text-gold-deep underline hover:text-forest"
            >
              {depth === 1 ? "Perluas 1 tingkat lagi (tampilkan Simbah & Putu)" : "Persempit ke 1 tingkat"}
            </button>
          </p>
          <div className="h-[400px] w-full rounded border border-wood/15">
            <FamilyGraph personId={person.id} depth={depth} />
          </div>
        </Dialog>
      )}
    </div>
  );
}

/**
 * Bagan keluarga sederhana dengan React Flow.
 * Menampilkan simpul orang dan garis relasi.
 */
function FamilyGraph({ personId, depth }: { personId: string; depth: number }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/family/graph?personId=${personId}&depth=${depth}`)
      .then((r) => r.json())
      .then((data) => {
        setNodes(data.nodes ?? []);
        setEdges(data.edges ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [personId, depth, setNodes, setEdges]);

  if (loading) {
    return <div className="flex h-full items-center justify-center text-sm text-muted">Memuat...</div>;
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      fitView
      minZoom={0.2}
      maxZoom={1.5}
      proOptions={{ hideAttribution: true }}
      nodesDraggable={false}
    >
      <Background color="#8a6238" gap={24} size={1} style={{ opacity: 0.12 }} />
    </ReactFlow>
  );
}
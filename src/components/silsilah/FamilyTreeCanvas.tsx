"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
  PersonNode,
  PersonNodeActionsContext,
  type PersonNodeActions,
} from "@/components/silsilah/PersonNode";
import { familyEdgeTypes } from "@/components/silsilah/FamilyEdges";
import {
  buildTreeGraph,
  getRootId,
  type FamilyTreeData,
} from "@/components/silsilah/treeLayout";
import { DetailPanel } from "@/components/silsilah/DetailPanel";
import { getGenerationLabel } from "@/lib/generations";
import type { PublicPerson } from "@/lib/data";

const nodeTypes = { person: PersonNode };
const edgeTypes = familyEdgeTypes;

/** Ambang zoom minimum: teks kartu tidak boleh turun di bawah ukuran baca. */
const MIN_ZOOM = 0.28;
const MAX_ZOOM = 1.6;

type AncestorEntry = { id: string; fullName: string; label: string };

/**
 * Jalur leluhur dari fokus ke akar: anak › orang tua › kakek. Dipakai untuk
 * breadcrumb yang bisa diketuk — jawaban atas pertanyaan "posisi saya di pohon".
 */
function ancestorPath(
  data: FamilyTreeData,
  focusId: string | null,
): AncestorEntry[] {
  if (!focusId) return [];
  const personById = new Map(data.persons.map((p) => [p.id, p]));
  const parentIdsByChild = new Map<string, string[]>();
  for (const e of data.childEdges) {
    if (!personById.has(e.parentId) || !personById.has(e.childId)) continue;
    const arr = parentIdsByChild.get(e.childId) ?? [];
    arr.push(e.parentId);
    parentIdsByChild.set(e.childId, arr);
  }

  const path: AncestorEntry[] = [];
  const seen = new Set<string>([focusId]);
  let current = focusId;
  // Naik satu orang tua per langkah, pilih yang generationLevel terkecil agar
  // jalur paling masuk akal secara budaya (ke leluhur), bukan sebaliknya.
  for (let guard = 0; guard < 32; guard++) {
    const parents = (parentIdsByChild.get(current) ?? []).filter(
      (id) => !seen.has(id),
    );
    if (parents.length === 0) break;
    parents.sort((a, b) => {
      const pa = personById.get(a);
      const pb = personById.get(b);
      return (pa?.generationLevel ?? 999) - (pb?.generationLevel ?? 999);
    });
    const next = parents[0];
    seen.add(next);
    const person = personById.get(next);
    if (!person) break;
    const level = person.generationLevel;
    const label =
      level === null || level === undefined
        ? "Orang tua"
        : level === 1
          ? person.gender === "MALE"
            ? "Ayah"
            : person.gender === "FEMALE"
              ? "Ibu"
              : "Orang tua"
          : level === 2
            ? person.gender === "MALE"
              ? "Kakek"
              : person.gender === "FEMALE"
                ? "Nenek"
                : "Kakek/Nenek"
            : getGenerationLabel(level);
    path.push({ id: next, fullName: person.fullName, label });
    current = next;
  }
  return path;
}

/** Daftar generasi yang benar-benar ada di data, untuk chip level generasi. */
function generationLevels(data: FamilyTreeData): number[] {
  const levels = new Set<number>();
  for (const p of data.persons) {
    if (typeof p.generationLevel === "number") levels.add(p.generationLevel);
  }
  return [...levels].sort((a, b) => a - b);
}

/**
 * Kanvas pohon silsilah. Hook React Flow (useNodesState/useEdgesState/
 * useReactFlow) menuntut `ReactFlowProvider` sebagai leluhur, jadi seluruh isi
 * hidup di `FamilyTreeCanvasInner` di bawah provider.
 */
export function FamilyTreeCanvas(props: {
  data: FamilyTreeData;
  isAuthenticated: boolean;
  /** personId milik pengguna yang login; null bila tamu atau belum tertaut. */
  sessionPersonId?: string | null;
}) {
  return (
    <ReactFlowProvider>
      <FamilyTreeCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function FamilyTreeCanvasInner({
  data,
  isAuthenticated,
  sessionPersonId,
}: {
  data: FamilyTreeData;
  isAuthenticated: boolean;
  sessionPersonId?: string | null;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<PublicPerson | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  // Level generasi yang disembunyikan. Kosong = semua generasi tampil.
  const [hiddenGenerations, setHiddenGenerations] = useState<Set<number>>(
    new Set(),
  );

  const rootId = useMemo(() => getRootId(data), [data]);
  const levels = useMemo(() => generationLevels(data), [data]);
  const ancestors = useMemo(
    () => ancestorPath(data, focusId),
    [data, focusId],
  );

  // Graf penuh dari treeLayout; posisi & struktur tidak lagi disalin ke state
  // terpisah lewat render-adjust (anti-pattern `prevGraph`/`setNodes` di fase
  // render). Sinkronisasi dilakukan di effect di bawah.
  const graph = useMemo(
    () => buildTreeGraph(data, collapsed, { showDisconnected: true }),
    [data, collapsed],
  );

  // Saring simpul per level generasi. `buildTreeGraph` tetap menghitung geometri
  // penuh; ini hanya lapisan tampilan supaya pengguna HP bisa menyembunyikan
  // generasi jauh.
  const visibleGraph = useMemo(() => {
    if (hiddenGenerations.size === 0) return graph;
    const nodes = graph.nodes.filter((n) => {
      const person = (n.data as { person?: PublicPerson }).person;
      const level = person?.generationLevel;
      // Level null (belum dihitung) selalu tampil: bukan "generasi jauh".
      if (level === null || level === undefined) return true;
      return !hiddenGenerations.has(level);
    });
    const visibleIds = new Set(nodes.map((n) => n.id));
    const edges = graph.edges.filter(
      (e) => visibleIds.has(e.source) && visibleIds.has(e.target),
    );
    return { nodes, edges };
  }, [graph, hiddenGenerations]);

  const [nodes, setNodes, onNodesChange] = useNodesState(visibleGraph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(visibleGraph.edges);

  // Sinkronkan state React Flow saat graf berubah (data/collapse/generasi).
  useEffect(() => {
    setNodes(visibleGraph.nodes);
    setEdges(visibleGraph.edges);
  }, [visibleGraph, setNodes, setEdges]);

  const { fitView } = useReactFlow();

  const nodeById = useMemo(() => {
    const map = new Map<string, (typeof nodes)[number]>();
    for (const n of visibleGraph.nodes) map.set(n.id, n);
    return map;
  }, [visibleGraph]);

  /** Fokus kanvas ke satu simpul dengan zoom yang membuat teks terbaca. */
  const focusOn = useCallback(
    (id: string | null) => {
      if (!id) return;
      const node = nodeById.get(id);
      if (!node) return;
      setFocusId(id);
      // fitView pada satu simpul: zoom dipatok ke MAX_ZOOM supaya kartu terbaca
      // penuh, bukan sekadar minZoom (kartu 168px * 1.6 = 269px di layar).
      fitView({
        nodes: [{ id }],
        padding: 0.2,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        duration: 400,
      });
    },
    [nodeById, fitView, setFocusId],
  );

  // Fokus awal: satu keluarga inti, bukan seluruh pohon. Prioritas: sesi login,
  // lalu simpul akar. Tanpa keduanya biarkan React Flow memakai `fitView`.
  const [initialFocusTarget] = useState<string | null>(
    () => sessionPersonId ?? rootId,
  );
  useEffect(() => {
    if (!initialFocusTarget) return;
    // Tunggu node terukur oleh React Flow sebelum memusatkan tampilan.
    const raf = requestAnimationFrame(() => focusOn(initialFocusTarget));
    return () => cancelAnimationFrame(raf);
  }, [initialFocusTarget, focusOn]);

  const openDetail = useCallback((person: PublicPerson) => {
    setSelected(person);
  }, []);

  const toggleCollapse = useCallback((personId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(personId)) next.delete(personId);
      else next.add(personId);
      return next;
    });
  }, []);

  const nodeActions: PersonNodeActions = useMemo(
    () => ({ openDetail, toggleCollapse, focusPerson: setFocusId }),
    [openDetail, toggleCollapse],
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (_e, node) => {
      const person = (node.data as { person?: PublicPerson }).person;
      if (person) openDetail(person);
    },
    [openDetail],
  );

  // Klik ganda tetap didukung sebagai jalan pintas lama, plus tombol eksplisit.
  const onNodeDoubleClick: NodeMouseHandler = useCallback(
    (_e, node) => {
      toggleCollapse(node.id);
    },
    [toggleCollapse],
  );

  const focusTargetLabel =
    sessionPersonId && nodeById.has(sessionPersonId)
      ? "saya"
      : "akar keluarga";

  if (visibleGraph.nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-muted">
        Belum ada data silsilah untuk ditampilkan, atau seluruh generasi
        disembunyikan lewat kontrol di atas.
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <PersonNodeActionsContext.Provider value={nodeActions}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          fitView
          fitViewOptions={{ padding: 0.25, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM }}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          onlyRenderVisibleElements
          proOptions={{ hideAttribution: true }}
          className="bg-transparent"
        >
          <Background color="#8a6238" gap={24} size={1} style={{ opacity: 0.12 }} />
          {/* Catatan: prop color Background react-flow menuntut warna literal;
              nilai ini = --color-wood-soft. Satu-satunya pengecualian hex. */}
          <Controls
            showInteractive={false}
            className="!rounded-md !border !border-wood/25 !bg-cream [&_button]:!h-11 [&_button]:!w-11 [&_button]:!text-lg"
          />
          <MiniMap
            pannable
            zoomable
            className="!hidden !rounded-md !border !border-wood/25 !bg-parchment sm:!block"
            maskColor="rgba(239, 227, 200, 0.6)"
            nodeColor="#2c4f3b"
          />
        </ReactFlow>
      </PersonNodeActionsContext.Provider>

      {/* ── Panel navigasi HP ── */}
      <div className="pointer-events-none absolute inset-x-2 top-2 flex flex-col gap-2 sm:inset-x-3 sm:top-3">
        {/* Breadcrumb jalur leluhur (anak › orang tua › kakek) */}
        {(ancestors.length > 0 || focusId) && (
          <nav
            aria-label="Posisi di pohon silsilah"
            className="pointer-events-auto flex max-w-full flex-wrap items-center gap-1 rounded-md border border-wood/25 bg-cream/95 px-2 py-1.5 text-xs shadow-sm"
          >
            <span className="font-medium text-forest">
              {focusId
                ? (nodeById.get(focusId)?.data as { person?: PublicPerson })
                    ?.person?.fullName ?? "Fokus"
                : "Pohon"}
            </span>
            {ancestors.map((a) => (
              <span key={a.id} className="flex items-center gap-1">
                <span aria-hidden="true" className="text-muted">
                  ›
                </span>
                <button
                  type="button"
                  onClick={() => focusOn(a.id)}
                  className="inline-flex min-h-6 items-center rounded-sm px-1 text-wood transition-colors hover:text-gold-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                >
                  <span className="text-muted">{a.label}</span>
                  <span className="ml-1 font-medium text-forest">{a.fullName}</span>
                </button>
              </span>
            ))}
          </nav>
        )}

        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => focusOn(sessionPersonId ?? rootId)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-forest px-3 text-xs font-semibold text-cream shadow-sm transition-colors hover:bg-forest-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="7" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
            Fokus ke {focusTargetLabel}
          </button>

          {rootId && focusId !== rootId && (
            <button
              type="button"
              onClick={() => focusOn(rootId)}
              className="inline-flex min-h-11 items-center rounded-md border border-wood/30 bg-cream/95 px-3 text-xs font-medium text-forest shadow-sm transition-colors hover:border-gold/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
            >
              Lihat akar
            </button>
          )}
        </div>

        {/* Kontrol level generasi: sembunyikan generasi jauh */}
        {levels.length > 1 && (
          <div className="pointer-events-auto rounded-md border border-wood/25 bg-cream/95 px-2 py-1.5 shadow-sm">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted">
              Generasi tampil
            </p>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setHiddenGenerations(new Set())}
                aria-pressed={hiddenGenerations.size === 0}
                className={`inline-flex min-h-7 items-center rounded-sm border px-2 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
                  hiddenGenerations.size === 0
                    ? "border-forest bg-forest text-cream"
                    : "border-wood/30 bg-cream text-forest hover:border-gold/60"
                }`}
              >
                Semua
              </button>
              {levels.map((level) => {
                const hidden = hiddenGenerations.has(level);
                return (
                  <button
                    key={level}
                    type="button"
                    aria-pressed={!hidden}
                    onClick={() =>
                      setHiddenGenerations((prev) => {
                        const next = new Set(prev);
                        if (next.has(level)) next.delete(level);
                        else next.add(level);
                        return next;
                      })
                    }
                    className={`inline-flex min-h-7 items-center rounded-sm border px-2 text-[11px] font-medium tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
                      hidden
                        ? "border-wood/20 bg-parchment text-muted line-through"
                        : "border-wood/30 bg-cream text-forest hover:border-gold/60"
                    }`}
                  >
                    {getGenerationLabel(level)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Legenda generasi kecil di kanvas */}
      <div className="pointer-events-none absolute bottom-2 left-2 rounded-md border border-wood/20 bg-cream/90 px-2 py-1 text-[10px] text-muted shadow-sm sm:bottom-3 sm:left-3">
        <span className="font-medium text-forest">Kartu</span> = orang ·{" "}
        <span className="font-medium text-forest">garis emas</span> = pasangan ·{" "}
        <span className="font-medium text-forest">garis coklat</span> = anak
      </div>

      <p className="pointer-events-none absolute bottom-2 right-2 hidden rounded-md bg-cream/90 px-3 py-1.5 text-xs text-muted shadow-sm sm:block">
        Ketuk kartu untuk detail, ketuk ikon fokus untuk memusatkan, ketuk
        tombol lipat untuk menyembunyikan cabang
      </p>

      {selected && (
        <DetailPanel
          person={selected}
          isAuthenticated={isAuthenticated}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

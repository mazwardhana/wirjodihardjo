"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { PersonNode, PersonNodeActionsContext } from "@/components/silsilah/PersonNode";
import {
  buildTreeGraph,
  type FamilyTreeData,
} from "@/components/silsilah/treeLayout";
import { DetailPanel } from "@/components/silsilah/DetailPanel";
import type { PublicPerson } from "@/lib/data";

const nodeTypes = { person: PersonNode };

export function FamilyTreeCanvas({
  data,
  isAuthenticated,
}: {
  data: FamilyTreeData;
  isAuthenticated: boolean;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<PublicPerson | null>(null);

  const graph = useMemo(
    () => buildTreeGraph(data, collapsed),
    [data, collapsed],
  );

  // State terkontrol React Flow. React Flow memiliki onNodesChange/onEdgesChange
  // untuk pilih dan interaksi; graph (memo pada [data, collapsed]) adalah
  // sumber kebenaran posisi dan struktur. Simpan referensi graph sebelumnya,
  // lalu pakai render-adjust (pola React "adjusting state when prop changes")
  // setiap kali graph berubah, agar nodes/edges selalu mencerminkan struktur
  // terbaru — menggantikan length-hack yang hanya bekerja saat jumlah berubah.
  // Memanggil setState di render komponen yang sama hanya memicu render ulang
  // sampai prevGraph === graph; tidak infinite loop karena graph bersifat memoized.
  const [prevGraph, setPrevGraph] = useState(graph);
  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges);
  if (prevGraph !== graph) {
    setPrevGraph(graph);
    setNodes(graph.nodes);
    setEdges(graph.edges);
  }

  const openDetail = useCallback((person: PublicPerson) => {
    setSelected(person);
  }, []);
  const nodeActions = useMemo(() => ({ openDetail }), [openDetail]);

  const onNodeClick: NodeMouseHandler = useCallback((_e, node) => {
    const person = (node.data as { person?: PublicPerson }).person;
    if (person) openDetail(person);
  }, [openDetail]);

  const onNodeDoubleClick: NodeMouseHandler = useCallback((_e, node) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(node.id)) next.delete(node.id);
      else next.add(node.id);
      return next;
    });
  }, []);

  if (graph.nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-muted">
        Belum ada data silsilah untuk ditampilkan.
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
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          fitView
          minZoom={0.1}
          maxZoom={1.6}
          proOptions={{ hideAttribution: true }}
          className="bg-transparent"
        >
          <Background color="#8a6238" gap={24} size={1} style={{ opacity: 0.12 }} />
          <Controls
            showInteractive={false}
            className="!rounded-md !border !border-wood/25 !bg-cream"
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

      <p className="pointer-events-none absolute left-3 top-3 rounded-md bg-cream/90 px-3 py-1.5 text-xs text-muted shadow-sm">
        Gulir untuk memperbesar, klik simpul atau tombol info untuk detail,
        klik ganda untuk melipat cabang keluarga
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
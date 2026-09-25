"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { PersonNode } from "@/components/silsilah/PersonNode";
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

  const [nodes, , onNodesChange] = useNodesState(graph.nodes);
  const [edges, , onEdgesChange] = useEdgesState(graph.edges);

  // Sinkronkan graph saat collapsed berubah
  const displayNodes = graph.nodes.length !== nodes.length ? graph.nodes : nodes;
  const displayEdges = graph.edges.length !== edges.length ? graph.edges : edges;

  const onNodeClick: NodeMouseHandler = useCallback((_e, node) => {
    const person = (node.data as { person?: PublicPerson }).person;
    if (person) setSelected(person);
  }, []);

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
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
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

      <p className="pointer-events-none absolute left-3 top-3 rounded-md bg-cream/90 px-3 py-1.5 text-xs text-muted shadow-sm">
        Gulir untuk memperbesar, klik simpul untuk detail, klik ganda untuk
        melipat cabang
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
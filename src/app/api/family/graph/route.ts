import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const personId = url.searchParams.get("personId");
  const depth = parseInt(url.searchParams.get("depth") ?? "1");

  if (!personId) return NextResponse.json({ error: "personId required" }, { status: 400 });

  // Collect nodes and edges recursively
  const visited = new Set<string>();
  const nodes: Array<{ id: string; position: { x: number; y: number }; data: Record<string, unknown> }> = [];
  const edges: Array<{ id: string; source: string; target: string; style?: Record<string, unknown> }> = [];

  const yStep = 130;
  const xSpread = 220;

  async function collect(id: string, level: number, xOffset: number): Promise<void> {
    if (visited.has(id) || level > depth) return;
    visited.add(id);

    const person = await prisma.person.findUnique({
      where: { id },
      select: { id: true, fullName: true, photoUrl: true, generationLevel: true, isDeceased: true },
    });
    if (!person) return;

    nodes.push({
      id: person.id,
      position: { x: xOffset, y: level * yStep },
      data: { label: person.fullName, ...person } as unknown as Record<string, unknown>,
    });

    if (level >= depth) return;

    // Koneksi ke pasangan (horizontal)
    const partners = await prisma.personPartner.findMany({
      where: { OR: [{ partnerAId: id }, { partnerBId: id }] },
      select: { partnerAId: true, partnerBId: true },
    });

    for (const p of partners) {
      const partnerId = p.partnerAId === id ? p.partnerBId : p.partnerAId;
      if (!visited.has(partnerId)) {
        await collect(partnerId, level, xOffset - xSpread + level * 10);
        edges.push({
          id: `partner-${id}-${partnerId}`,
          source: id,
          target: partnerId,
          style: { stroke: "#b4872a", strokeWidth: 1.5, strokeDasharray: "4 3" },
        });
      }
    }

    // Anak-anak (ke bawah)
    const children = await prisma.personChild.findMany({
      where: { parentId: id },
      select: { childId: true, isStep: true, isAdopted: true },
    });

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (!visited.has(child.childId)) {
        await collect(child.childId, level + 1, xOffset + (i - (children.length - 1) / 2) * 180);
        edges.push({
          id: `child-${id}-${child.childId}`,
          source: id,
          target: child.childId,
          style: child.isStep || child.isAdopted
            ? { stroke: "#8a6238", strokeWidth: 1, strokeDasharray: "4 4" }
            : { stroke: "#6f4a2b", strokeWidth: 1.5 },
        });
      }
    }

    // Orang tua (ke atas)
    const parentEdges = await prisma.personChild.findMany({
      where: { childId: id },
      select: { parentId: true, isStep: true },
    });

    for (let i = 0; i < parentEdges.length; i++) {
      const p = parentEdges[i];
      if (!visited.has(p.parentId)) {
        await collect(p.parentId, level - 1, xOffset + (i - (parentEdges.length - 1) / 2) * 180);
        edges.push({
          id: `parent-${p.parentId}-${id}`,
          source: p.parentId,
          target: id,
          style: p.isStep
            ? { stroke: "#8a6238", strokeWidth: 1, strokeDasharray: "4 4" }
            : { stroke: "#6f4a2b", strokeWidth: 1.5 },
        });
      }
    }
  }

  // Mulai dari level tengah agar orang tua di atas, anak di bawah
  await collect(personId, 2, 0);

  // Normalisasi posisi agar tidak negatif
  const minX = nodes.length > 0 ? Math.min(...nodes.map((n) => n.position.x)) : 0;
  const minY = nodes.length > 0 ? Math.min(...nodes.map((n) => n.position.y)) : 0;
  for (const node of nodes) {
    node.position.x -= minX - 40;
    node.position.y -= minY - 40;
  }

  return NextResponse.json({ nodes, edges });
}
"use client";

import { BaseEdge, type EdgeProps } from "@xyflow/react";
import type {
  FamilyChildEdgeData,
  FamilyMarriageEdgeData,
} from "@/components/silsilah/treeLayout";

/** Sudut pembulatan konektor ortogonal. */
const CORNER_RADIUS = 8;

/**
 * Path ortogonal untuk satu garis keturunan:
 *   turun dari titik asal keluarga → horizontal di bus saudara → turun ke anak.
 * Titik asal dan bus diambil dari data (koordinat absolut kanvas), bukan dari
 * handle, supaya garis tidak mengipas dari kartu orang tua.
 */
export function familyChildPath(
  originX: number,
  originY: number,
  busY: number,
  targetX: number,
  targetY: number,
): string {
  // Orang tua dan anak segaris: cukup satu garis lurus ke bawah.
  if (Math.abs(targetX - originX) < 1) {
    return `M ${originX} ${originY} L ${targetX} ${targetY}`;
  }

  const dir = targetX > originX ? 1 : -1;
  const r = Math.max(
    0,
    Math.min(
      CORNER_RADIUS,
      Math.abs(targetX - originX) / 2,
      Math.abs(busY - originY),
      Math.abs(targetY - busY),
    ),
  );

  return [
    `M ${originX} ${originY}`,
    `L ${originX} ${busY - r}`,
    `Q ${originX} ${busY} ${originX + dir * r} ${busY}`,
    `L ${targetX - dir * r} ${busY}`,
    `Q ${targetX} ${busY} ${targetX} ${busY + r}`,
    `L ${targetX} ${targetY}`,
  ].join(" ");
}

/** Garis keturunan ortogonal (satu per anak). */
export function FamilyChildEdge({ data, style, targetX, targetY }: EdgeProps) {
  const { originX, originY, busY } = data as unknown as FamilyChildEdgeData;
  return (
    <BaseEdge
      path={familyChildPath(originX, originY, busY, targetX, targetY)}
      style={style}
    />
  );
}

/** Garis pernikahan horizontal pada tengah tinggi kartu. */
export function FamilyMarriageEdge({ data, style, sourceX, targetX }: EdgeProps) {
  const { y } = data as unknown as FamilyMarriageEdgeData;
  return <BaseEdge path={`M ${sourceX} ${y} L ${targetX} ${y}`} style={style} />;
}

export const familyEdgeTypes = {
  familyChild: FamilyChildEdge,
  familyMarriage: FamilyMarriageEdge,
};

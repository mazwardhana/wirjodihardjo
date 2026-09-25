"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { getGenerationLabel } from "@/lib/generations";
import { initials } from "@/lib/utils";
import type { PublicPerson } from "@/lib/data";

export type PersonNodeData = {
  person: PublicPerson;
  childCount: number;
  hasHiddenChildren: boolean;
  collapsed: boolean;
};

function PersonNodeComponent({ data, selected }: NodeProps) {
  const d = data as unknown as PersonNodeData;
  const { person, childCount, hasHiddenChildren } = d;

  return (
    <div
      className={`w-[200px] rounded-lg border bg-cream px-3 py-2.5 shadow-sm transition-all ${
        selected
          ? "border-gold ring-2 ring-gold/40"
          : "border-wood/25 hover:border-gold/60"
      } ${person.isDeceased ? "opacity-80" : ""}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-1.5 !w-1.5 !border-0 !bg-wood/40"
      />
      <div className="flex items-center gap-2">
        {person.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={person.photoUrl}
            alt=""
            className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-gold/40"
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-forest/10 text-[10px] font-semibold text-forest ring-1 ring-forest/15"
          >
            {initials(person.fullName)}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold leading-tight text-forest">
            {person.fullName}
          </p>
          <p className="truncate text-[10px] font-medium text-wood">
            {getGenerationLabel(person.generationLevel)}
          </p>
        </div>
      </div>

      <div className="mt-1.5 flex items-center justify-between">
        {person.isDeceased && (
          <span className="text-[9px] uppercase tracking-wide text-muted">
            Almarhum
          </span>
        )}
        {childCount > 0 && (
          <span className="ml-auto rounded-full bg-forest/10 px-1.5 py-0.5 text-[9px] font-medium text-forest">
            {hasHiddenChildren ? `${childCount} disembunyikan` : `${childCount} anak`}
          </span>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-1.5 !w-1.5 !border-0 !bg-wood/40"
      />
    </div>
  );
}

export const PersonNode = memo(PersonNodeComponent);
"use client";

import { X, BookOpen, GraduationCap, Network } from "lucide-react";
import Link from "next/link";
import type { GraphNode } from "./types";
import { MASTERY_COLORS, MASTERY_LABELS } from "./colors";

type Props = {
  node: GraphNode;
  onClose: () => void;
  onHighlightNeighbors: () => void;
};

export function GraphNodeDetail({ node, onClose, onHighlightNeighbors }: Props) {
  const firstLoId = node.learningObjectIds?.[0];

  return (
    <div className="absolute right-4 top-4 w-72 rounded-xl border border-border/30 bg-background/95 backdrop-blur-sm p-4 z-10 shadow-lg">
      <div className="flex items-start justify-between">
        <h3 className="text-[14px] font-medium">{node.name}</h3>
        <button
          onClick={onClose}
          className="text-muted-foreground/40 hover:text-foreground transition-colors"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {node.definition && (
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground/60">
          {node.definition}
        </p>
      )}

      <div className="mt-3 flex gap-3 text-[11px]">
        <div>
          <span className="text-muted-foreground/40">Mastery</span>
          <div className="flex items-center gap-1 mt-0.5">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: MASTERY_COLORS[node.mastery] }}
            />
            <span className="font-medium">{MASTERY_LABELS[node.mastery]}</span>
          </div>
        </div>
        {node.difficulty && (
          <div>
            <span className="text-muted-foreground/40">Difficulty</span>
            <p className="font-medium mt-0.5">{node.difficulty}/5</p>
          </div>
        )}
        {node.domain && (
          <div>
            <span className="text-muted-foreground/40">Domain</span>
            <p className="font-medium mt-0.5">{node.domain}</p>
          </div>
        )}
        {(node.learningObjectIds?.length ?? 0) > 1 && (
          <div>
            <span className="text-muted-foreground/40">Sources</span>
            <p className="font-medium mt-0.5 text-amber-500">
              {node.learningObjectIds?.length} docs
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-2 border-t border-border/20 pt-3">
        {firstLoId && (
          <Link
            href={`/library/${firstLoId}`}
            className="flex items-center gap-1.5 rounded-md border border-border/30 px-2.5 py-1.5 text-[11px] font-medium hover:bg-muted/30 transition-colors"
          >
            <BookOpen className="size-3" />
            View Content
          </Link>
        )}
        <Link
          href={`/review?concept=${node.id}`}
          className="flex items-center gap-1.5 rounded-md border border-border/30 px-2.5 py-1.5 text-[11px] font-medium hover:bg-muted/30 transition-colors"
        >
          <GraduationCap className="size-3" />
          Review
        </Link>
        <button
          onClick={onHighlightNeighbors}
          className="flex items-center gap-1.5 rounded-md border border-border/30 px-2.5 py-1.5 text-[11px] font-medium hover:bg-muted/30 transition-colors"
        >
          <Network className="size-3" />
          Related
        </button>
      </div>
    </div>
  );
}

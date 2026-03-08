"use client";

import type { GraphViewMode } from "@repo/shared";
import { MASTERY_COLORS, MASTERY_LABELS, domainColor } from "./colors";

type Props = {
  viewMode: GraphViewMode;
  allDomains: string[];
};

export function GraphLegend({ viewMode, allDomains }: Props) {
  return (
    <div className="absolute bottom-4 left-4 flex flex-col gap-2 rounded-lg bg-background/80 backdrop-blur-sm border border-border/20 px-3 py-2 z-10">
      {viewMode === "mastery" && (
        <div className="flex gap-3">
          {MASTERY_LABELS.map((label, i) => (
            <div key={label} className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: MASTERY_COLORS[i] }}
              />
              <span className="text-[10px] text-muted-foreground/50">{label}</span>
            </div>
          ))}
        </div>
      )}
      {viewMode === "retrievability" && (
        <div className="flex gap-3">
          {[
            { label: "Fresh", color: "#10b981" },
            { label: "OK", color: "#fbbf24" },
            { label: "Fading", color: "#f97316" },
            { label: "Critical", color: "#ef4444" },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[10px] text-muted-foreground/50">{label}</span>
            </div>
          ))}
        </div>
      )}
      {viewMode === "domain" && allDomains.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {allDomains.slice(0, 8).map((d) => (
            <div key={d} className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: domainColor(d, allDomains) }}
              />
              <span className="text-[10px] text-muted-foreground/50">{d}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-3 border-t border-border/20 pt-1.5">
        <div className="flex items-center gap-1.5">
          <span className="w-4 border-t border-zinc-400" />
          <span className="text-[10px] text-muted-foreground/50">Prerequisite</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 border-t border-dashed border-zinc-400" />
          <span className="text-[10px] text-muted-foreground/50">Related</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 border-t border-dotted border-zinc-400" />
          <span className="text-[10px] text-muted-foreground/50">Part of</span>
        </div>
      </div>
    </div>
  );
}

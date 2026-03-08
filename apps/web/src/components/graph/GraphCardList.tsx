"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  GraduationCap,
  ChevronDown,
  ChevronRight,
  Search,
  FileText,
  Video,
  Globe,
  Image,
  Music,
  Presentation,
  X,
} from "lucide-react";
import type { GraphNode, GraphViewMode } from "./types";
import { MASTERY_COLORS, MASTERY_LABELS, domainColor } from "./colors";
import { getNodeColor } from "./rendering";

type SourceInfo = { id: string; title: string; sourceType: string };

const SOURCE_ICONS: Record<string, typeof FileText> = {
  pdf: FileText,
  youtube: Video,
  url: Globe,
  image: Image,
  audio: Music,
  pptx: Presentation,
  docx: FileText,
  ai_generated: FileText,
};

type Props = {
  nodes: GraphNode[];
  allDomains: string[];
  viewMode: GraphViewMode;
  filterMastery: number | null;
  setFilterMastery: (v: number | null) => void;
  filterSourceId: string | null;
  setFilterSourceId: (v: string | null) => void;
  sources: SourceInfo[];
  searchQuery: string;
  setSearchQuery: (v: string) => void;
};

export function GraphCardList({
  nodes,
  allDomains,
  viewMode,
  filterMastery,
  setFilterMastery,
  filterSourceId,
  setFilterSourceId,
  sources,
  searchQuery,
  setSearchQuery,
}: Props) {
  const [collapsedDomains, setCollapsedDomains] = useState<Set<string>>(new Set());

  const filteredNodes = useMemo(() => {
    let result = nodes;
    if (filterMastery !== null) result = result.filter((n) => n.mastery === filterMastery);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((n) => n.name.toLowerCase().includes(q));
    }
    return result;
  }, [nodes, filterMastery, searchQuery]);

  const grouped = useMemo(() => {
    const map = new Map<string, GraphNode[]>();
    for (const node of filteredNodes) {
      const domain = node.domain ?? "Other";
      if (!map.has(domain)) map.set(domain, []);
      map.get(domain)!.push(node);
    }
    for (const [, nodes] of map) {
      nodes.sort((a, b) => (b.mastery - a.mastery) || ((a.difficulty ?? 3) - (b.difficulty ?? 3)));
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [filteredNodes]);

  const toggleDomain = (domain: string) => {
    setCollapsedDomains((prev) => {
      const next = new Set(prev);
      next.has(domain) ? next.delete(domain) : next.add(domain);
      return next;
    });
  };

  const masteryStats = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0];
    for (const n of nodes) counts[n.mastery]++;
    return counts;
  }, [nodes]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        {/* Stats bar */}
        <div className="flex items-center gap-1.5 rounded-lg border border-border/30 p-2">
          {MASTERY_LABELS.map((label, i) => {
            const pct = nodes.length ? (masteryStats[i] / nodes.length) * 100 : 0;
            return (
              <button
                key={label}
                onClick={() => setFilterMastery(filterMastery === i ? null : i)}
                className={cn(
                  "relative flex-1 rounded-md py-2 text-center transition-all",
                  filterMastery === i
                    ? "bg-muted/60 ring-1 ring-foreground/10"
                    : "hover:bg-muted/30"
                )}
              >
                <div className="text-[15px] font-semibold" style={{ color: MASTERY_COLORS[i] }}>
                  {masteryStats[i]}
                </div>
                <div className="text-[9px] text-muted-foreground/50 mt-0.5">{label}</div>
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full" style={{
                  width: `${Math.max(pct, 4)}%`,
                  backgroundColor: MASTERY_COLORS[i],
                  opacity: 0.5,
                }} />
              </button>
            );
          })}
        </div>

        {/* Source filter */}
        {sources.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <span className="text-[10px] text-muted-foreground/40 shrink-0">Source:</span>
            <button
              onClick={() => setFilterSourceId(null)}
              className={cn(
                "shrink-0 rounded-full px-2.5 py-0.5 text-[10px] border transition-colors",
                !filterSourceId
                  ? "border-foreground/30 bg-muted/50 text-foreground font-medium"
                  : "border-border/30 text-muted-foreground/50 hover:text-foreground"
              )}
            >
              All
            </button>
            {sources.map((s) => {
              const Icon = SOURCE_ICONS[s.sourceType] ?? FileText;
              return (
                <button
                  key={s.id}
                  onClick={() => setFilterSourceId(filterSourceId === s.id ? null : s.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] border transition-colors max-w-[180px]",
                    filterSourceId === s.id
                      ? "border-foreground/30 bg-muted/50 text-foreground font-medium"
                      : "border-border/30 text-muted-foreground/50 hover:text-foreground"
                  )}
                >
                  <Icon className="size-2.5 shrink-0" />
                  <span className="truncate">{s.title}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Active filter indicator */}
        {filterSourceId && (
          <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-1.5">
            <span className="text-[11px] text-primary">
              Showing concepts from: <span className="font-medium">{sources.find((s) => s.id === filterSourceId)?.title}</span>
            </span>
            <button onClick={() => setFilterSourceId(null)} className="text-primary/50 hover:text-primary">
              <X className="size-3" />
            </button>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search concepts..."
            className="w-full rounded-lg border border-border/30 bg-transparent pl-9 pr-3 py-2 text-[13px] placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/40"
          />
        </div>

        {/* Domain groups */}
        {grouped.map(([domain, domainNodes]) => {
          const isCollapsed = collapsedDomains.has(domain);
          const color = domainColor(domain === "Other" ? null : domain, allDomains);
          const domainMastery = domainNodes.reduce((sum, n) => sum + n.mastery, 0) / domainNodes.length;

          return (
            <div key={domain} className="rounded-xl border border-border/30 overflow-hidden">
              {/* Domain header */}
              <button
                onClick={() => toggleDomain(domain)}
                className="flex w-full items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
              >
                <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-[13px] font-semibold flex-1 text-left">{domain}</span>
                <span className="text-[11px] text-muted-foreground/40">{domainNodes.length} concepts</span>
                {/* Mini mastery bar */}
                <div className="w-16 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(domainMastery / 5) * 100}%`, backgroundColor: color }}
                  />
                </div>
                {isCollapsed ? (
                  <ChevronRight className="size-3.5 text-muted-foreground/40" />
                ) : (
                  <ChevronDown className="size-3.5 text-muted-foreground/40" />
                )}
              </button>

              {/* Concept cards */}
              {!isCollapsed && (
                <div className="border-t border-border/20">
                  {domainNodes.map((node, idx) => (
                    <ConceptCard
                      key={node.id}
                      node={node}
                      viewMode={viewMode}
                      allDomains={allDomains}
                      isLast={idx === domainNodes.length - 1}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {filteredNodes.length === 0 && (
          <div className="py-12 text-center text-[13px] text-muted-foreground/40">
            No concepts match your filters.
          </div>
        )}
      </div>
    </div>
  );
}

function ConceptCard({
  node,
  viewMode,
  allDomains,
  isLast,
}: {
  node: GraphNode;
  viewMode: GraphViewMode;
  allDomains: string[];
  isLast: boolean;
}) {
  const color = getNodeColor(node, viewMode, allDomains);
  const firstLoId = node.learningObjectIds?.[0];

  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-3 hover:bg-muted/10 transition-colors group",
      !isLast && "border-b border-border/10"
    )}>
      {/* Color accent + mastery indicator */}
      <div className="flex flex-col items-center gap-1 shrink-0 w-8">
        <div
          className="size-6 rounded-lg flex items-center justify-center text-[10px] font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {node.mastery}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium truncate">{node.name}</span>
          {(node.learningObjectIds?.length ?? 0) > 1 && (
            <span className="shrink-0 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-600">
              {node.learningObjectIds?.length} sources
            </span>
          )}
        </div>
        {node.definition && (
          <p className="mt-0.5 text-[11px] text-muted-foreground/50 line-clamp-1">
            {node.definition}
          </p>
        )}
        <div className="flex items-center gap-3 mt-1.5">
          {/* Mastery bar */}
          <div className="flex items-center gap-1.5 flex-1 max-w-[140px]">
            <div className="flex-1 h-1.5 rounded-full bg-muted/30 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(node.mastery / 5) * 100}%`, backgroundColor: color }}
              />
            </div>
            <span className="text-[9px] text-muted-foreground/40 shrink-0">
              {MASTERY_LABELS[node.mastery]}
            </span>
          </div>
          {node.difficulty && (
            <span className="text-[9px] text-muted-foreground/30">
              Diff {node.difficulty}/5
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {firstLoId && (
          <Link
            href={`/library/${firstLoId}`}
            className="flex size-7 items-center justify-center rounded-md border border-border/30 hover:bg-muted/30 transition-colors"
            title="View content"
          >
            <BookOpen className="size-3" />
          </Link>
        )}
        <Link
          href={`/review?concept=${node.id}`}
          className="flex size-7 items-center justify-center rounded-md border border-border/30 hover:bg-muted/30 transition-colors"
          title="Start review"
        >
          <GraduationCap className="size-3" />
        </Link>
      </div>
    </div>
  );
}

"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { trpc } from "@/trpc/client";
import {
  ArrowLeft,
  Loader2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
  Filter,
  Link2,
  Search,
  Share2,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { GraphViewMode } from "@repo/shared";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

type GraphNode = {
  id: string;
  name: string;
  definition?: string | null;
  domain?: string | null;
  difficulty?: number | null;
  mastery: number;
  val: number;
  x: number;
  y: number;
  learningObjectIds?: string[];
  isCrossSource?: boolean;
};

type GraphLink = {
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
};

type ForceGraphRef = {
  centerAt: (x: number, y: number, ms: number) => void;
  zoom: (z?: number, ms?: number) => number;
  zoomToFit: (ms: number, padding: number) => void;
} | null;

const MASTERY_COLORS = ["#a1a1aa", "#60a5fa", "#a78bfa", "#fbbf24", "#34d399", "#10b981"];

const RETRIEVABILITY_COLORS = (r: number) => {
  if (r >= 0.9) return "#10b981";
  if (r >= 0.7) return "#34d399";
  if (r >= 0.5) return "#fbbf24";
  if (r >= 0.3) return "#f97316";
  return "#ef4444";
};

const DOMAIN_COLORS = [
  "#6366f1",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#8b5cf6",
  "#06b6d4",
  "#84cc16",
  "#f43f5e",
  "#a855f7",
  "#22c55e",
];

function domainColor(domain: string | null, allDomains: string[]) {
  if (!domain) return "#71717a";
  const idx = allDomains.indexOf(domain);
  return DOMAIN_COLORS[idx % DOMAIN_COLORS.length];
}

export default function GraphPage() {
  const { data, isLoading } = trpc.review.getGraphData.useQuery();
  const graphRef = useRef<ForceGraphRef>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [filterMastery, setFilterMastery] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [highlightCrossSource, setHighlightCrossSource] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [viewMode, setViewMode] = useState<GraphViewMode>("mastery");

  const allDomains = useMemo(() => {
    const domains = new Set<string>();
    for (const n of data?.nodes ?? []) {
      if (n.domain) domains.add(n.domain);
    }
    return Array.from(domains);
  }, [data?.nodes]);

  const allNodes = useMemo(
    () =>
      (data?.nodes ?? []).map((n) => ({
        id: n.id,
        name: n.name ?? "Unknown",
        definition: n.definition,
        domain: n.domain,
        difficulty: n.difficulty,
        mastery: n.mastery ?? 0,
        val: (n.difficulty ?? 3) * 2,
        learningObjectIds: n.learningObjectIds ?? [],
        isCrossSource: n.isCrossSource ?? false,
      })),
    [data?.nodes]
  );

  const graphData = useMemo(() => {
    let nodes = allNodes;
    if (filterMastery !== null) nodes = nodes.filter((n) => n.mastery === filterMastery);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      nodes = nodes.filter((n) => n.name.toLowerCase().includes(q));
    }
    const nodeIds = new Set(nodes.map((n) => n.id));
    const links = (data?.edges ?? [])
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => ({ source: e.source, target: e.target, type: e.type }));
    return { nodes, links };
  }, [allNodes, data?.edges, filterMastery, searchQuery]);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
    graphRef.current?.centerAt(node.x, node.y, 500);
    graphRef.current?.zoom(3, 500);
  }, []);

  const handleSearchSelect = useCallback(
    (node: GraphNode) => {
      setShowSearch(false);
      setSearchQuery("");
      handleNodeClick(node);
    },
    [handleNodeClick]
  );

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allNodes.filter((n) => n.name.toLowerCase().includes(q)).slice(0, 8);
  }, [allNodes, searchQuery]);

  const getNodeColor = useCallback(
    (node: GraphNode): string => {
      if (viewMode === "retrievability") {
        return RETRIEVABILITY_COLORS(0.5);
      }
      if (viewMode === "domain") {
        return domainColor(node.domain, allDomains);
      }
      return MASTERY_COLORS[node.mastery] ?? MASTERY_COLORS[0];
    },
    [viewMode, allDomains]
  );

  const nodeCanvasObject = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D) => {
      const r = Math.sqrt(node.val) * 3;
      const color = getNodeColor(node);
      const isCross = node.isCrossSource && (node.learningObjectIds?.length ?? 0) > 1;

      if (highlightCrossSource && isCross) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 4, 0, 2 * Math.PI);
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.stroke();
      }

      if (node.mastery >= 5) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 3, 0, 2 * Math.PI);
        ctx.fillStyle = `${color}33`;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = highlightCrossSource && !isCross ? `${color}40` : color;
      ctx.fill();

      if (node.mastery === 2 || node.mastery === 3) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
        ctx.stroke();
      }

      if (node.mastery === 0) {
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (selectedNode?.id === node.id) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.stroke();
      }

      ctx.fillStyle = "#71717a";
      ctx.font = "3px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(node.name, node.x, node.y + r + 5);
    },
    [selectedNode, highlightCrossSource, getNodeColor]
  );

  const linkCanvasObject = useCallback((link: GraphLink, ctx: CanvasRenderingContext2D) => {
    const src = typeof link.source === "object" ? link.source : null;
    const tgt = typeof link.target === "object" ? link.target : null;
    if (!src || !tgt) return;

    ctx.beginPath();
    ctx.strokeStyle = "rgba(113,113,122,0.25)";
    ctx.lineWidth = 1;

    if (link.type === "prerequisite") ctx.setLineDash([]);
    else if (link.type === "related_to") ctx.setLineDash([4, 3]);
    else if (link.type === "part_of") ctx.setLineDash([1, 3]);
    else ctx.setLineDash([6, 2]);

    ctx.moveTo(src.x, src.y);
    ctx.lineTo(tgt.x, tgt.y);
    ctx.stroke();
    ctx.setLineDash([]);

    if (link.type === "prerequisite" || link.type === "part_of") {
      const angle = Math.atan2(tgt.y - src.y, tgt.x - src.x);
      const nodeR = Math.sqrt((tgt as GraphNode).val ?? 6) * 3;
      const arrowX = tgt.x - Math.cos(angle) * (nodeR + 2);
      const arrowY = tgt.y - Math.sin(angle) * (nodeR + 2);
      const arrowLen = 4;

      ctx.beginPath();
      ctx.fillStyle = "rgba(113,113,122,0.35)";
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(
        arrowX - arrowLen * Math.cos(angle - Math.PI / 6),
        arrowY - arrowLen * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        arrowX - arrowLen * Math.cos(angle + Math.PI / 6),
        arrowY - arrowLen * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();
    }
  }, []);

  const handleShareGraph = useCallback(async () => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;
    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        if (navigator.share) {
          const file = new File([blob], "knowledge-graph.png", { type: "image/png" });
          await navigator.share({ files: [file], title: "My Knowledge Graph" });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "knowledge-graph.png";
          a.click();
          URL.revokeObjectURL(url);
          toast.success("Graph image downloaded");
        }
      });
    } catch {
      toast.error("Failed to share graph");
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (graphData.nodes.length === 0 && !searchQuery) {
    return (
      <div className="flex h-screen flex-col items-center justify-center text-center px-6">
        <h1 className="text-lg font-medium">No concepts yet</h1>
        <p className="mt-1 text-[13px] text-muted-foreground/60">
          Upload content to build your knowledge graph.
        </p>
        <Link href="/" className="mt-3 text-[13px] text-primary hover:underline">
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border/30 px-4">
        <Link href="/" className="text-muted-foreground/60 hover:text-foreground transition-colors">
          <ArrowLeft className="size-4" />
        </Link>
        <span className="text-[13px] font-medium">Knowledge Graph</span>
        <span className="text-[11px] text-muted-foreground/40">
          {graphData.nodes.length} concepts
        </span>
        <div className="flex-1" />

        {/* View mode toggle */}
        <div className="flex rounded-lg border border-border/30 overflow-hidden mr-2">
          {(
            [
              { mode: "mastery" as const, label: "Mastery" },
              { mode: "retrievability" as const, label: "Decay" },
              { mode: "domain" as const, label: "Domain" },
            ] as const
          ).map(({ mode: m, label }) => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={cn(
                "px-2 py-0.5 text-[10px] transition-colors",
                viewMode === m
                  ? "bg-muted/50 text-foreground font-medium"
                  : "text-muted-foreground/50 hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex gap-1">
          <button
            onClick={() => setShowSearch((s) => !s)}
            className={cn(
              "flex size-7 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-muted/50",
              showSearch && "bg-muted/50 text-foreground"
            )}
          >
            <Search className="size-3.5" />
          </button>
          <button
            onClick={() => setHighlightCrossSource((v) => !v)}
            className={cn(
              "flex size-7 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-muted/50",
              highlightCrossSource && "bg-amber-500/10 text-amber-500"
            )}
            title="Highlight cross-source"
          >
            <Link2 className="size-3.5" />
          </button>
          <button
            onClick={() => setShowFilters((f) => !f)}
            className={cn(
              "flex size-7 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-muted/50",
              showFilters && "bg-muted/50 text-foreground"
            )}
          >
            <Filter className="size-3.5" />
          </button>
          <button
            onClick={handleShareGraph}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-muted/50"
            title="Share graph"
          >
            <Share2 className="size-3.5" />
          </button>
          <button
            onClick={() => graphRef.current?.zoom(graphRef.current.zoom() * 1.5, 300)}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-muted/50"
          >
            <ZoomIn className="size-3.5" />
          </button>
          <button
            onClick={() => graphRef.current?.zoom(graphRef.current.zoom() / 1.5, 300)}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-muted/50"
          >
            <ZoomOut className="size-3.5" />
          </button>
          <button
            onClick={() => graphRef.current?.zoomToFit(400, 40)}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-muted/50"
          >
            <Maximize2 className="size-3.5" />
          </button>
        </div>
      </header>

      <div className="relative flex-1">
        {/* Search panel */}
        {showSearch && (
          <div className="absolute left-4 top-4 z-10 w-64 rounded-lg border border-border/30 bg-background/95 backdrop-blur-sm p-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search concepts..."
              autoFocus
              className="w-full rounded-md border border-border/30 bg-transparent px-2.5 py-1.5 text-[12px] placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/40"
            />
            {searchResults.length > 0 && (
              <div className="mt-2 space-y-0.5 max-h-48 overflow-y-auto">
                {searchResults.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleSearchSelect(n as GraphNode)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-muted/30"
                  >
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ backgroundColor: MASTERY_COLORS[n.mastery] }}
                    />
                    <span className="truncate">{n.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Filter panel */}
        {showFilters && (
          <div
            className="absolute left-4 top-4 z-10 rounded-lg border border-border/30 bg-background/95 backdrop-blur-sm p-3 space-y-2"
            style={{ top: showSearch ? "220px" : "16px" }}
          >
            <p className="text-[11px] font-medium text-muted-foreground/60">Filter by mastery</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setFilterMastery(null)}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[10px] border transition-colors",
                  filterMastery === null
                    ? "border-foreground/30 bg-muted/50 text-foreground"
                    : "border-border/30 text-muted-foreground/50 hover:text-foreground"
                )}
              >
                All
              </button>
              {["Unknown", "Exposed", "Practicing", "Familiar", "Proficient", "Mastered"].map(
                (label, i) => (
                  <button
                    key={label}
                    onClick={() => setFilterMastery(filterMastery === i ? null : i)}
                    className={cn(
                      "flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] border transition-colors",
                      filterMastery === i
                        ? "border-foreground/30 bg-muted/50 text-foreground"
                        : "border-border/30 text-muted-foreground/50 hover:text-foreground"
                    )}
                  >
                    <span
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: MASTERY_COLORS[i] }}
                    />
                    {label}
                  </button>
                )
              )}
            </div>
          </div>
        )}

        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          nodeCanvasObject={nodeCanvasObject}
          onNodeClick={handleNodeClick}
          linkCanvasObject={linkCanvasObject}
          linkColor={() => "rgba(113,113,122,0.15)"}
          linkWidth={1}
          backgroundColor="transparent"
          cooldownTicks={100}
        />

        {/* Legend */}
        <div className="absolute bottom-4 left-4 flex flex-col gap-2 rounded-lg bg-background/80 backdrop-blur-sm border border-border/20 px-3 py-2">
          {viewMode === "mastery" && (
            <div className="flex gap-3">
              {["Unknown", "Exposed", "Practicing", "Familiar", "Proficient", "Mastered"].map(
                (label, i) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: MASTERY_COLORS[i] }}
                    />
                    <span className="text-[10px] text-muted-foreground/50">{label}</span>
                  </div>
                )
              )}
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

        {/* Minimap indicator */}
        {graphData.nodes.length > 50 && (
          <div className="absolute bottom-4 right-4 size-24 rounded-lg border border-border/20 bg-background/60 backdrop-blur-sm overflow-hidden">
            <div className="flex items-center justify-center h-full text-[9px] text-muted-foreground/30">
              {graphData.nodes.length} nodes
            </div>
          </div>
        )}

        {/* Node detail panel */}
        {selectedNode && (
          <div className="absolute right-4 top-4 w-72 rounded-xl border border-border/30 bg-background/95 backdrop-blur-sm p-4">
            <div className="flex items-start justify-between">
              <h3 className="text-[14px] font-medium">{selectedNode.name}</h3>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-muted-foreground/40 hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>
            {selectedNode.definition && (
              <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground/60">
                {selectedNode.definition}
              </p>
            )}
            <div className="mt-3 flex gap-3 text-[11px]">
              <div>
                <span className="text-muted-foreground/40">Mastery</span>
                <div className="flex items-center gap-1 mt-0.5">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: MASTERY_COLORS[selectedNode.mastery] }}
                  />
                  <span className="font-medium">
                    {
                      ["Unknown", "Exposed", "Practicing", "Familiar", "Proficient", "Mastered"][
                        selectedNode.mastery
                      ]
                    }
                  </span>
                </div>
              </div>
              {selectedNode.difficulty && (
                <div>
                  <span className="text-muted-foreground/40">Difficulty</span>
                  <p className="font-medium mt-0.5">{selectedNode.difficulty}/5</p>
                </div>
              )}
              {selectedNode.domain && (
                <div>
                  <span className="text-muted-foreground/40">Domain</span>
                  <p className="font-medium mt-0.5">{selectedNode.domain}</p>
                </div>
              )}
              {(selectedNode.learningObjectIds?.length ?? 0) > 1 && (
                <div>
                  <span className="text-muted-foreground/40">Sources</span>
                  <p className="font-medium mt-0.5 text-amber-500">
                    {selectedNode.learningObjectIds?.length} docs
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

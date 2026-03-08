"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { trpc } from "@/trpc/client";
import { ArrowLeft, Loader2, ZoomIn, ZoomOut, Maximize2, X, Filter } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

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

const MASTERY_COLORS = [
  "#a1a1aa", // 0 - unknown
  "#60a5fa", // 1 - exposed
  "#a78bfa", // 2 - practicing
  "#fbbf24", // 3 - familiar
  "#34d399", // 4 - proficient
  "#10b981", // 5 - mastered
];

export default function GraphPage() {
  const { data, isLoading } = trpc.review.getGraphData.useQuery();
  const graphRef = useRef<ForceGraphRef>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [filterMastery, setFilterMastery] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);

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
      })),
    [data?.nodes]
  );

  const graphData = useMemo(() => {
    const nodes =
      filterMastery !== null ? allNodes.filter((n) => n.mastery === filterMastery) : allNodes;
    const nodeIds = new Set(nodes.map((n) => n.id));
    const links = (data?.edges ?? [])
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => ({ source: e.source, target: e.target, type: e.type }));
    return { nodes, links };
  }, [allNodes, data?.edges, filterMastery]);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
    graphRef.current?.centerAt(node.x, node.y, 500);
    graphRef.current?.zoom(3, 500);
  }, []);

  const nodeCanvasObject = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D) => {
      const r = Math.sqrt(node.val) * 3;
      const color = MASTERY_COLORS[node.mastery] ?? MASTERY_COLORS[0];

      // Mastered: outer glow
      if (node.mastery >= 5) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 3, 0, 2 * Math.PI);
        ctx.fillStyle = `${color}33`;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      // In-progress (Practicing/Familiar): pulsing ring
      if (node.mastery === 2 || node.mastery === 3) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
        ctx.stroke();
      }

      // Gap detected (Unknown with reviews): dashed red border
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
    [selectedNode]
  );

  const linkCanvasObject = useCallback((link: GraphLink, ctx: CanvasRenderingContext2D) => {
    const src = typeof link.source === "object" ? link.source : null;
    const tgt = typeof link.target === "object" ? link.target : null;
    if (!src || !tgt) return;

    ctx.beginPath();
    ctx.strokeStyle = "rgba(113,113,122,0.25)";
    ctx.lineWidth = 1;

    if (link.type === "prerequisite") {
      ctx.setLineDash([]);
    } else if (link.type === "related_to") {
      ctx.setLineDash([4, 3]);
    } else if (link.type === "part_of") {
      ctx.setLineDash([1, 3]);
    } else {
      ctx.setLineDash([6, 2]);
    }

    ctx.moveTo(src.x, src.y);
    ctx.lineTo(tgt.x, tgt.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Arrow head for prerequisite / part_of
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

    // Diamond for part_of
    if (link.type === "part_of") {
      const midX = (src.x + tgt.x) / 2;
      const midY = (src.y + tgt.y) / 2;
      const ds = 3;
      const angle = Math.atan2(tgt.y - src.y, tgt.x - src.x);
      ctx.beginPath();
      ctx.fillStyle = "rgba(113,113,122,0.3)";
      ctx.moveTo(midX + ds * Math.cos(angle), midY + ds * Math.sin(angle));
      ctx.lineTo(
        midX + ds * Math.cos(angle + Math.PI / 2),
        midY + ds * Math.sin(angle + Math.PI / 2)
      );
      ctx.lineTo(midX + ds * Math.cos(angle + Math.PI), midY + ds * Math.sin(angle + Math.PI));
      ctx.lineTo(
        midX + ds * Math.cos(angle - Math.PI / 2),
        midY + ds * Math.sin(angle - Math.PI / 2)
      );
      ctx.closePath();
      ctx.fill();
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (graphData.nodes.length === 0) {
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
        <div className="flex gap-1">
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
        {/* Filter panel */}
        {showFilters && (
          <div className="absolute left-4 top-4 z-10 rounded-lg border border-border/30 bg-background/95 backdrop-blur-sm p-3 space-y-2">
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

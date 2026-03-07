"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { trpc } from "@/trpc/client";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Loader2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

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
  const graphRef = useRef<any>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);

  const graphData = {
    nodes: (data?.nodes ?? []).map((n) => ({
      id: n.id,
      name: n.name ?? "Unknown",
      definition: n.definition,
      domain: n.domain,
      difficulty: n.difficulty,
      mastery: n.mastery ?? 0,
      val: (n.difficulty ?? 3) * 2,
    })),
    links: (data?.edges ?? []).map((e) => ({
      source: e.source,
      target: e.target,
      type: e.type,
    })),
  };

  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node);
    graphRef.current?.centerAt(node.x, node.y, 500);
    graphRef.current?.zoom(3, 500);
  }, []);

  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D) => {
    const r = Math.sqrt(node.val) * 3;
    const color = MASTERY_COLORS[node.mastery] ?? MASTERY_COLORS[0];

    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();

    if (selectedNode?.id === node.id) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.fillStyle = "#71717a";
    ctx.font = "3px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(node.name, node.x, node.y + r + 5);
  }, [selectedNode]);

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
        <Link href="/" className="mt-3 text-[13px] text-primary hover:underline">Back to Home</Link>
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
        <span className="text-[11px] text-muted-foreground/40">{graphData.nodes.length} concepts</span>
        <div className="flex-1" />
        <div className="flex gap-1">
          <button onClick={() => graphRef.current?.zoom(graphRef.current.zoom() * 1.5, 300)} className="flex size-7 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-muted/50">
            <ZoomIn className="size-3.5" />
          </button>
          <button onClick={() => graphRef.current?.zoom(graphRef.current.zoom() / 1.5, 300)} className="flex size-7 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-muted/50">
            <ZoomOut className="size-3.5" />
          </button>
          <button onClick={() => graphRef.current?.zoomToFit(400, 40)} className="flex size-7 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-muted/50">
            <Maximize2 className="size-3.5" />
          </button>
        </div>
      </header>

      <div className="relative flex-1">
        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          nodeCanvasObject={nodeCanvasObject}
          onNodeClick={handleNodeClick}
          linkColor={() => "rgba(113,113,122,0.15)"}
          linkWidth={1}
          backgroundColor="transparent"
          cooldownTicks={100}
        />

        {/* Legend */}
        <div className="absolute bottom-4 left-4 flex gap-3 rounded-lg bg-background/80 backdrop-blur-sm border border-border/20 px-3 py-2">
          {["Unknown", "Exposed", "Practicing", "Familiar", "Proficient", "Mastered"].map((label, i) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ backgroundColor: MASTERY_COLORS[i] }} />
              <span className="text-[10px] text-muted-foreground/50">{label}</span>
            </div>
          ))}
        </div>

        {/* Node detail panel */}
        {selectedNode && (
          <div className="absolute right-4 top-4 w-72 rounded-xl border border-border/30 bg-background/95 backdrop-blur-sm p-4">
            <div className="flex items-start justify-between">
              <h3 className="text-[14px] font-medium">{selectedNode.name}</h3>
              <button onClick={() => setSelectedNode(null)} className="text-muted-foreground/40 hover:text-foreground">
                <X className="size-3.5" />
              </button>
            </div>
            {selectedNode.definition && (
              <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground/60">{selectedNode.definition}</p>
            )}
            <div className="mt-3 flex gap-3 text-[11px]">
              <div>
                <span className="text-muted-foreground/40">Mastery</span>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="size-2 rounded-full" style={{ backgroundColor: MASTERY_COLORS[selectedNode.mastery] }} />
                  <span className="font-medium">{["Unknown", "Exposed", "Practicing", "Familiar", "Proficient", "Mastered"][selectedNode.mastery]}</span>
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

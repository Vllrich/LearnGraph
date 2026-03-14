"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type {
  GraphNode,
  GraphLink,
  GraphData,
  ForceGraphRef,
  GraphViewMode,
  GraphLayoutMode,
} from "./types";
import { FileText, Video, Globe, Image, Music, Presentation } from "lucide-react";
import { MASTERY_COLORS } from "./colors";

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
import { drawNode, drawLink, drawClusterBoundaries } from "./rendering";
import { buildNeighborSet, computeClusterPositions, getClusterForceTargets, getDagModeForLayout, toDagSafeLinks } from "./layouts";
import { GraphNodeDetail } from "./GraphNodeDetail";
import { GraphLegend } from "./GraphLegend";
import { GraphCardList } from "./GraphCardList";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

type SourceInfo = { id: string; title: string; sourceType: string };

type Props = {
  graphData: GraphData;
  allNodes: GraphNode[];
  allDomains: string[];
  viewMode: GraphViewMode;
  layoutMode: GraphLayoutMode;
  highlightCrossSource: boolean;
  showSearch: boolean;
  showFilters: boolean;
  filterMastery: number | null;
  setFilterMastery: (v: number | null) => void;
  filterSourceId: string | null;
  setFilterSourceId: (v: string | null) => void;
  sources: SourceInfo[];
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  graphRef: React.MutableRefObject<ForceGraphRef>;
};

export function GraphCanvas({
  graphData,
  allNodes,
  allDomains,
  viewMode,
  layoutMode,
  highlightCrossSource,
  showSearch,
  showFilters,
  filterMastery,
  setFilterMastery,
  filterSourceId,
  setFilterSourceId,
  sources,
  searchQuery,
  setSearchQuery,
  graphRef,
}: Props) {
  const router = useRouter();
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [currentZoom, setCurrentZoom] = useState(1);

  const neighborIds = useMemo(
    () => buildNeighborSet(hoveredNode?.id ?? null, graphData.links),
    [hoveredNode, graphData.links]
  );

  const clusters = useMemo(() => {
    if (layoutMode !== "clusters") return new Map();
    return computeClusterPositions(graphData.nodes, allDomains);
  }, [graphData.nodes, allDomains, layoutMode]);

  const clusterTargets = useMemo(() => {
    if (layoutMode !== "clusters") return new Map();
    return getClusterForceTargets(graphData.nodes, allDomains);
  }, [graphData.nodes, allDomains, layoutMode]);

  useEffect(() => {
    if (!graphRef.current) return;
    const fg = graphRef.current;
    const d3 = getD3Forces();
    if (!d3) return;

    if (layoutMode === "clusters") {
      fg.d3Force("center", null);
      fg.d3Force("x", d3.forceX<GraphNode>().x((node) => {
        return clusterTargets.get(node.domain ?? "Other")?.x ?? 0;
      }).strength(0.3));
      fg.d3Force("y", d3.forceY<GraphNode>().y((node) => {
        return clusterTargets.get(node.domain ?? "Other")?.y ?? 0;
      }).strength(0.3));
      fg.d3Force("charge", d3.forceManyBody().strength(-80));
      fg.d3Force("collide", d3.forceCollide<GraphNode>().radius((node) => {
        return 4 + (node.mastery ?? 0) * 1.5 + ((node.difficulty ?? 3) * 0.8) + 8;
      }));
      fg.d3ReheatSimulation();
    } else if (layoutMode === "force") {
      fg.d3Force("x", null);
      fg.d3Force("y", null);
      fg.d3Force("center", d3.forceCenter(0, 0));
      fg.d3Force("charge", d3.forceManyBody().strength(-120));
      fg.d3Force("collide", d3.forceCollide<GraphNode>().radius((node) => {
        return 4 + (node.mastery ?? 0) * 1.5 + ((node.difficulty ?? 3) * 0.8) + 10;
      }));
      fg.d3ReheatSimulation();
    } else {
      fg.d3Force("x", null);
      fg.d3Force("y", null);
      fg.d3Force("center", d3.forceCenter(0, 0));
      fg.d3Force("charge", d3.forceManyBody().strength(-100));
      fg.d3Force("collide", null);
      fg.d3ReheatSimulation();
    }
  }, [layoutMode, graphRef, clusterTargets]);

  const dagMode = getDagModeForLayout(layoutMode);

  const effectiveGraphData = useMemo(() => {
    if (!dagMode) return graphData;
    return { nodes: graphData.nodes, links: toDagSafeLinks(graphData.links) };
  }, [graphData, dagMode]);

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      setSelectedNode(node);
      graphRef.current?.centerAt(node.x, node.y, 500);
      graphRef.current?.zoom(3, 500);
    },
    [graphRef]
  );

  const handleNodeDoubleClick = useCallback(
    (node: GraphNode) => {
      const firstLoId = node.learningObjectIds?.[0];
      if (firstLoId) router.push(`/library/${firstLoId}`);
    },
    [router]
  );

  const handleNodeHover = useCallback((node: GraphNode | null) => {
    setHoveredNode(node);
  }, []);

  const handleZoom = useCallback(({ k }: { k: number }) => {
    setCurrentZoom(k);
  }, []);

  const handleHighlightNeighbors = useCallback(() => {
    if (selectedNode) {
      setHoveredNode(selectedNode);
    }
  }, [selectedNode]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allNodes.filter((n) => n.name.toLowerCase().includes(q)).slice(0, 8);
  }, [allNodes, searchQuery]);

  const handleSearchSelect = useCallback(
    (node: GraphNode) => {
      setSearchQuery("");
      handleNodeClick(node);
    },
    [handleNodeClick, setSearchQuery]
  );

  const nodeCanvasObject = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D) => {
      drawNode(node, ctx, {
        hoveredNodeId: hoveredNode?.id ?? null,
        selectedNodeId: selectedNode?.id ?? null,
        neighborIds,
        highlightCrossSource,
        viewMode,
        layoutMode,
        allDomains,
        zoom: currentZoom,
      });
    },
    [hoveredNode, selectedNode, neighborIds, highlightCrossSource, viewMode, layoutMode, allDomains, currentZoom]
  );

  const linkCanvasObject = useCallback(
    (link: GraphLink, ctx: CanvasRenderingContext2D) => {
      drawLink(link, ctx, {
        hoveredNodeId: hoveredNode?.id ?? null,
        neighborIds,
        layoutMode,
        viewMode,
        allDomains,
      });
    },
    [hoveredNode, neighborIds, layoutMode, viewMode, allDomains]
  );

  const canvasPostDraw = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (layoutMode === "clusters" && clusters.size > 0) {
        drawClusterBoundaries(ctx, clusters);
      }
    },
    [layoutMode, clusters]
  );

  if (layoutMode === "cardtree") {
    return (
      <GraphCardList
        nodes={graphData.nodes}
        allDomains={allDomains}
        viewMode={viewMode}
        filterMastery={filterMastery}
        setFilterMastery={setFilterMastery}
        filterSourceId={filterSourceId}
        setFilterSourceId={setFilterSourceId}
        sources={sources}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />
    );
  }

  return (
    <div className="relative flex-1">
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

      {showFilters && (
        <div
          className="absolute left-4 z-10 w-64 rounded-lg border border-border/30 bg-background/95 backdrop-blur-sm p-3 space-y-3"
          style={{ top: showSearch ? "220px" : "16px" }}
        >
          <div>
            <p className="text-[11px] font-medium text-muted-foreground/60 mb-1.5">
              Filter by mastery
            </p>
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

          {sources.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-muted-foreground/60 mb-1.5">
                Filter by source
              </p>
              <div className="space-y-0.5 max-h-40 overflow-y-auto">
                <button
                  onClick={() => setFilterSourceId(null)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] transition-colors",
                    !filterSourceId
                      ? "bg-muted/50 text-foreground font-medium"
                      : "text-muted-foreground/60 hover:bg-muted/30 hover:text-foreground"
                  )}
                >
                  All sources
                </button>
                {sources.map((s) => {
                  const Icon = SOURCE_ICONS[s.sourceType] ?? FileText;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setFilterSourceId(filterSourceId === s.id ? null : s.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] transition-colors",
                        filterSourceId === s.id
                          ? "bg-muted/50 text-foreground font-medium"
                          : "text-muted-foreground/60 hover:bg-muted/30 hover:text-foreground"
                      )}
                    >
                      <Icon className="size-3 shrink-0" />
                      <span className="truncate">{s.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <ForceGraph2D
        ref={graphRef}
        graphData={effectiveGraphData}
        nodeCanvasObject={nodeCanvasObject}
        nodeCanvasObjectMode={() => "replace"}
        onNodeClick={handleNodeClick}
        onNodeRightClick={handleNodeDoubleClick}
        onNodeHover={handleNodeHover}
        linkCanvasObject={linkCanvasObject}
        linkCanvasObjectMode={() => "replace"}
        linkColor={() => "transparent"}
        linkWidth={0}
        backgroundColor="transparent"
        cooldownTicks={200}
        warmupTicks={50}
        onRenderFramePost={canvasPostDraw}
        onZoom={handleZoom}
        onBackgroundRightClick={() => { setSelectedNode(null); setHoveredNode(null); }}
        dagMode={dagMode}
        dagLevelDistance={layoutMode === "hierarchical" ? 60 : undefined}
        onEngineStop={() => {
          if (graphData.nodes.length > 0) {
            graphRef.current?.zoomToFit(400, 60);
          }
        }}
      />

      <GraphLegend viewMode={viewMode} allDomains={allDomains} />

      {selectedNode && (
        <GraphNodeDetail
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onHighlightNeighbors={handleHighlightNeighbors}
        />
      )}
    </div>
  );
}

function getD3Forces() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const d3Force = require("d3-force") as typeof import("d3-force");
    return {
      forceCenter: d3Force.forceCenter,
      forceManyBody: d3Force.forceManyBody,
      forceCollide: d3Force.forceCollide,
      forceX: d3Force.forceX,
      forceY: d3Force.forceY,
    };
  } catch {
    return null;
  }
}

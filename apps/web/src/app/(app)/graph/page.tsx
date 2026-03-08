"use client";

import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { trpc } from "@/trpc/client";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { GraphViewMode, GraphLayoutMode } from "@repo/shared";
import type { GraphNode, ForceGraphRef } from "@/components/graph/types";
import { GraphToolbar } from "@/components/graph/GraphToolbar";
import { GraphCanvas } from "@/components/graph/GraphCanvas";

export default function GraphPage() {
  const { data, isLoading } = trpc.review.getGraphData.useQuery();
  const graphRef = useRef<ForceGraphRef>(null);
  const [filterMastery, setFilterMastery] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [highlightCrossSource, setHighlightCrossSource] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [viewMode, setViewMode] = useState<GraphViewMode>(() => {
    if (typeof window === "undefined") return "mastery";
    return (localStorage.getItem("lg-graph-view") as GraphViewMode) ?? "mastery";
  });
  const [layoutMode, setLayoutMode] = useState<GraphLayoutMode>(() => {
    if (typeof window === "undefined") return "force";
    return (localStorage.getItem("lg-graph-layout") as GraphLayoutMode) ?? "force";
  });
  const [filterSourceId, setFilterSourceId] = useState<string | null>(null);

  const handleSetViewMode = useCallback((m: GraphViewMode) => {
    setViewMode(m);
    localStorage.setItem("lg-graph-view", m);
  }, []);

  const handleSetLayoutMode = useCallback((m: GraphLayoutMode) => {
    setLayoutMode(m);
    localStorage.setItem("lg-graph-layout", m);
  }, []);

  const sources = data?.sources ?? [];

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
        retrievability: (n as { retrievability?: number | null }).retrievability ?? null,
        val: (n.difficulty ?? 3) * 2,
        learningObjectIds: n.learningObjectIds ?? [],
        isCrossSource: n.isCrossSource ?? false,
      })) as GraphNode[],
    [data?.nodes]
  );

  const graphData = useMemo(() => {
    let nodes = allNodes;
    if (filterMastery !== null) nodes = nodes.filter((n) => n.mastery === filterMastery);
    if (filterSourceId) nodes = nodes.filter((n) => n.learningObjectIds?.includes(filterSourceId));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      nodes = nodes.filter((n) => n.name.toLowerCase().includes(q));
    }
    const nodeIds = new Set(nodes.map((n) => n.id));
    const links = (data?.edges ?? [])
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => ({ source: e.source, target: e.target, type: e.type }));
    return { nodes, links };
  }, [allNodes, data?.edges, filterMastery, filterSourceId, searchQuery]);

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

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "Escape") {
        setShowSearch(false);
        setShowFilters(false);
      }
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        graphRef.current?.zoomToFit(400, 40);
      }
      if (e.key === "1") handleSetLayoutMode("force");
      if (e.key === "2") handleSetLayoutMode("hierarchical");
      if (e.key === "3") handleSetLayoutMode("clusters");
      if (e.key === "4") handleSetLayoutMode("cardtree");
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (graphData.nodes.length === 0 && !searchQuery && !filterSourceId && filterMastery === null) {
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
      <GraphToolbar
        nodeCount={graphData.nodes.length}
        viewMode={viewMode}
        setViewMode={handleSetViewMode}
        layoutMode={layoutMode}
        setLayoutMode={handleSetLayoutMode}
        showSearch={showSearch}
        setShowSearch={setShowSearch}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        highlightCrossSource={highlightCrossSource}
        setHighlightCrossSource={setHighlightCrossSource}
        onZoomIn={() => graphRef.current?.zoom((graphRef.current?.zoom() ?? 1) * 1.5, 300)}
        onZoomOut={() => graphRef.current?.zoom((graphRef.current?.zoom() ?? 1) / 1.5, 300)}
        onFitView={() => graphRef.current?.zoomToFit(400, 40)}
        onShare={handleShareGraph}
      />

      <GraphCanvas
        graphData={graphData}
        allNodes={allNodes}
        allDomains={allDomains}
        viewMode={viewMode}
        layoutMode={layoutMode}
        highlightCrossSource={highlightCrossSource}
        showSearch={showSearch}
        showFilters={showFilters}
        filterMastery={filterMastery}
        setFilterMastery={setFilterMastery}
        filterSourceId={filterSourceId}
        setFilterSourceId={setFilterSourceId}
        sources={sources}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        graphRef={graphRef}
      />
    </div>
  );
}

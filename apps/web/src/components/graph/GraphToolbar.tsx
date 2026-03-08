"use client";

import {
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Filter,
  Link2,
  Search,
  Share2,
  Network,
  GitBranch,
  LayoutGrid,
  SquareKanban,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { GraphViewMode, GraphLayoutMode } from "@repo/shared";

type Props = {
  nodeCount: number;
  viewMode: GraphViewMode;
  setViewMode: (m: GraphViewMode) => void;
  layoutMode: GraphLayoutMode;
  setLayoutMode: (m: GraphLayoutMode) => void;
  showSearch: boolean;
  setShowSearch: (v: boolean) => void;
  showFilters: boolean;
  setShowFilters: (v: boolean) => void;
  highlightCrossSource: boolean;
  setHighlightCrossSource: (v: boolean) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onShare: () => void;
};

const VIEW_MODES: { mode: GraphViewMode; label: string }[] = [
  { mode: "mastery", label: "Mastery" },
  { mode: "retrievability", label: "Decay" },
  { mode: "domain", label: "Domain" },
];

const LAYOUT_MODES: { mode: GraphLayoutMode; label: string; icon: typeof Network }[] = [
  { mode: "force", label: "Force", icon: Network },
  { mode: "hierarchical", label: "Tree", icon: GitBranch },
  { mode: "clusters", label: "Clusters", icon: LayoutGrid },
  { mode: "cardtree", label: "Cards", icon: SquareKanban },
];

export function GraphToolbar(props: Props) {
  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border/30 px-4">
      <Link
        href="/"
        className="text-muted-foreground/60 hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
      </Link>
      <span className="text-[13px] font-medium">Knowledge Graph</span>
      <span className="text-[11px] text-muted-foreground/40">
        {props.nodeCount} concepts
      </span>
      <div className="flex-1" />

      {/* Layout mode toggle */}
      <div className="flex rounded-lg border border-border/30 overflow-hidden mr-1">
        {LAYOUT_MODES.map(({ mode, label, icon: Icon }) => (
          <button
            key={mode}
            onClick={() => props.setLayoutMode(mode)}
            title={label}
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 text-[10px] transition-colors",
              props.layoutMode === mode
                ? "bg-muted/50 text-foreground font-medium"
                : "text-muted-foreground/40 hover:text-foreground"
            )}
          >
            <Icon className="size-3" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-border/30" />

      {/* View mode toggle */}
      <div className="flex rounded-lg border border-border/30 overflow-hidden mr-1">
        {VIEW_MODES.map(({ mode, label }) => (
          <button
            key={mode}
            onClick={() => props.setViewMode(mode)}
            className={cn(
              "px-2 py-0.5 text-[10px] transition-colors",
              props.viewMode === mode
                ? "bg-muted/50 text-foreground font-medium"
                : "text-muted-foreground/40 hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex gap-1">
        <ToolbarButton
          active={props.showSearch}
          onClick={() => props.setShowSearch(!props.showSearch)}
          title="Search"
        >
          <Search className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={props.highlightCrossSource}
          activeClass="bg-amber-500/10 text-amber-500"
          onClick={() => props.setHighlightCrossSource(!props.highlightCrossSource)}
          title="Highlight cross-source"
        >
          <Link2 className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={props.showFilters}
          onClick={() => props.setShowFilters(!props.showFilters)}
          title="Filter"
        >
          <Filter className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={props.onShare} title="Share graph">
          <Share2 className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={props.onZoomIn} title="Zoom in">
          <ZoomIn className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={props.onZoomOut} title="Zoom out">
          <ZoomOut className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={props.onFitView} title="Fit to view">
          <Maximize2 className="size-3.5" />
        </ToolbarButton>
      </div>
    </header>
  );
}

function ToolbarButton({
  active,
  activeClass,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  activeClass?: string;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "flex size-7 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-muted/50 transition-colors",
        active && (activeClass ?? "bg-muted/50 text-foreground")
      )}
    >
      {children}
    </button>
  );
}

import type { GraphViewMode, GraphLayoutMode } from "@repo/shared";

export type GraphNode = {
  id: string;
  name: string;
  definition?: string | null;
  domain?: string | null;
  difficulty?: number | null;
  mastery: number;
  retrievability?: number | null;
  val: number;
  x: number;
  y: number;
  fx?: number;
  fy?: number;
  learningObjectIds?: string[];
  isCrossSource?: boolean;
};

export type GraphLink = {
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
};

export type GraphData = {
  nodes: GraphNode[];
  links: GraphLink[];
};

export type ForceGraphRef = {
  centerAt: (x: number, y: number, ms: number) => void;
  zoom: (z?: number, ms?: number) => number;
  zoomToFit: (ms: number, padding: number) => void;
  d3Force: (name: string, force?: unknown) => unknown;
  d3ReheatSimulation: () => void;
} | null;

export { type GraphViewMode, type GraphLayoutMode };

import type { GraphNode, GraphLink, GraphLayoutMode } from "./types";
import { domainColor } from "./colors";

export function computeClusterPositions(
  nodes: GraphNode[],
  allDomains: string[]
): Map<string, { nodes: GraphNode[]; color: string; label: string }> {
  const clusters = new Map<string, { nodes: GraphNode[]; color: string; label: string }>();

  for (const node of nodes) {
    const domain = node.domain ?? "Other";
    if (!clusters.has(domain)) {
      clusters.set(domain, {
        nodes: [],
        color: domainColor(node.domain ?? null, allDomains),
        label: domain,
      });
    }
    clusters.get(domain)!.nodes.push(node);
  }

  return clusters;
}

export function getClusterForceTargets(
  nodes: GraphNode[],
  allDomains: string[]
): Map<string, { x: number; y: number }> {
  const domainTargets = new Map<string, { x: number; y: number }>();
  const count = allDomains.length || 1;
  const radius = 200 + count * 30;

  allDomains.forEach((domain, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    domainTargets.set(domain, {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    });
  });
  domainTargets.set("Other", { x: 0, y: 0 });

  return domainTargets;
}

type DagMode = "td" | "bu" | "lr" | "rl" | "radialout" | "radialin";

export function getDagModeForLayout(
  mode: GraphLayoutMode
): DagMode | undefined {
  switch (mode) {
    case "hierarchical":
      return "td";
    default:
      return undefined;
  }
}

/** Strip "related_to" edges and remove any remaining cycles so dagMode won't crash. */
export function toDagSafeLinks(links: GraphLink[]): GraphLink[] {
  const directional = links.filter(
    (l) => l.type === "prerequisite" || l.type === "part_of"
  );

  const adj = new Map<string, Set<string>>();
  const safe: GraphLink[] = [];

  for (const link of directional) {
    const src = typeof link.source === "object" ? link.source.id : link.source;
    const tgt = typeof link.target === "object" ? link.target.id : link.target;

    if (hasCycle(adj, tgt, src)) continue;

    if (!adj.has(src)) adj.set(src, new Set());
    adj.get(src)!.add(tgt);
    safe.push(link);
  }
  return safe;
}

function hasCycle(adj: Map<string, Set<string>>, from: string, to: string): boolean {
  if (from === to) return true;
  const visited = new Set<string>();
  const stack = [from];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === to) return true;
    if (visited.has(cur)) continue;
    visited.add(cur);
    const neighbors = adj.get(cur);
    if (neighbors) for (const n of neighbors) stack.push(n);
  }
  return false;
}

export function buildNeighborSet(
  nodeId: string | null,
  links: GraphLink[]
): Set<string> {
  const set = new Set<string>();
  if (!nodeId) return set;
  set.add(nodeId);
  for (const link of links) {
    const srcId = typeof link.source === "object" ? link.source.id : link.source;
    const tgtId = typeof link.target === "object" ? link.target.id : link.target;
    if (srcId === nodeId) set.add(tgtId);
    if (tgtId === nodeId) set.add(srcId);
  }
  return set;
}

import type { GraphNode, GraphLink, GraphViewMode, GraphLayoutMode } from "./types";
import {
  MASTERY_COLORS,
  retrievabilityColor,
  domainColor,
} from "./colors";

export function getNodeRadius(node: GraphNode): number {
  return 4 + node.mastery * 1.5 + ((node.difficulty ?? 3) * 0.8);
}

export function getNodeColor(
  node: GraphNode,
  viewMode: GraphViewMode,
  allDomains: string[]
): string {
  if (viewMode === "retrievability") {
    return retrievabilityColor(node.retrievability ?? 0);
  }
  if (viewMode === "domain") {
    return domainColor(node.domain ?? null, allDomains);
  }
  return MASTERY_COLORS[node.mastery] ?? MASTERY_COLORS[0];
}

export type NodeRenderOpts = {
  hoveredNodeId: string | null;
  selectedNodeId: string | null;
  neighborIds: Set<string>;
  highlightCrossSource: boolean;
  viewMode: GraphViewMode;
  layoutMode: GraphLayoutMode;
  allDomains: string[];
  zoom: number;
};

export function drawNode(
  node: GraphNode,
  ctx: CanvasRenderingContext2D,
  opts: NodeRenderOpts
) {
  if (!isFinite(node.x) || !isFinite(node.y)) return;

  const r = getNodeRadius(node);
  const color = getNodeColor(node, opts.viewMode, opts.allDomains);
  const isHovered = opts.hoveredNodeId === node.id;
  const isSelected = opts.selectedNodeId === node.id;
  const isDimmed =
    opts.hoveredNodeId !== null &&
    !isHovered &&
    !opts.neighborIds.has(node.id);
  const isCross =
    opts.highlightCrossSource &&
    node.isCrossSource &&
    (node.learningObjectIds?.length ?? 0) > 1;

  const alpha = isDimmed ? 0.12 : 1;
  const drawR = isSelected || isHovered ? r * 1.2 : r;

  ctx.save();
  ctx.globalAlpha = alpha;

  if (isCross) {
    ctx.beginPath();
    ctx.arc(node.x, node.y, drawR + 4, 0, 2 * Math.PI);
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.stroke();
  }

  if (node.mastery >= 5) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(node.x, node.y, drawR + 3, 0, 2 * Math.PI);
    ctx.fillStyle = `${color}22`;
    ctx.fill();
    ctx.restore();
  }

  const gradient = ctx.createRadialGradient(
    node.x - drawR * 0.3,
    node.y - drawR * 0.3,
    drawR * 0.1,
    node.x,
    node.y,
    drawR
  );
  gradient.addColorStop(0, lightenHex(color, 40));
  gradient.addColorStop(1, color);

  ctx.beginPath();
  ctx.arc(node.x, node.y, drawR, 0, 2 * Math.PI);
  ctx.fillStyle = gradient;
  ctx.fill();

  if (node.mastery === 0) {
    ctx.strokeStyle = `${color}60`;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (isSelected || isHovered) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.stroke();
  }

  const fontSize = Math.max(3, Math.min(11, 11 / (opts.zoom || 1)));
  if (opts.zoom > 0.4 || isHovered || isSelected) {
    const label = node.name;
    ctx.font = `${isHovered || isSelected ? "600" : "400"} ${fontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const textWidth = ctx.measureText(label).width;
    const pillPadX = 3;
    const pillPadY = 1.5;
    const textY = node.y + drawR + 3;

    ctx.fillStyle = isDimmed ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.75)";
    roundRect(
      ctx,
      node.x - textWidth / 2 - pillPadX,
      textY - pillPadY,
      textWidth + pillPadX * 2,
      fontSize + pillPadY * 2,
      2
    );
    ctx.fill();

    ctx.fillStyle = isDimmed ? "rgba(113,113,122,0.2)" : "#3f3f46";
    ctx.fillText(label, node.x, textY);
  }

  ctx.restore();
}

// ─── Link Drawing ────────────────────────────────────────────────────────────

export function drawLink(
  link: GraphLink,
  ctx: CanvasRenderingContext2D,
  opts: Pick<NodeRenderOpts, "hoveredNodeId" | "neighborIds" | "layoutMode" | "viewMode" | "allDomains">
) {
  const src = typeof link.source === "object" ? link.source : null;
  const tgt = typeof link.target === "object" ? link.target : null;
  if (!src || !tgt) return;
  if (!isFinite(src.x) || !isFinite(tgt.x)) return;

  const isHighlighted =
    opts.hoveredNodeId !== null &&
    (src.id === opts.hoveredNodeId || tgt.id === opts.hoveredNodeId);
  const isDimmed = opts.hoveredNodeId !== null && !isHighlighted;

  ctx.save();

  const baseAlpha = isHighlighted ? 0.5 : isDimmed ? 0.04 : 0.2;
  ctx.strokeStyle = isHighlighted
    ? getNodeColor(src, opts.viewMode, opts.allDomains)
    : `rgba(113,113,122,${baseAlpha})`;
  ctx.lineWidth = isHighlighted ? 1.5 : 1;

  if (link.type === "prerequisite") ctx.setLineDash([]);
  else if (link.type === "related_to") ctx.setLineDash([4, 3]);
  else if (link.type === "part_of") ctx.setLineDash([1, 3]);
  else ctx.setLineDash([6, 2]);

  ctx.beginPath();
  ctx.moveTo(src.x, src.y);
  ctx.lineTo(tgt.x, tgt.y);
  ctx.stroke();
  ctx.setLineDash([]);

  if (link.type === "prerequisite" || link.type === "part_of") {
    const angle = Math.atan2(tgt.y - src.y, tgt.x - src.x);
    const nodeR = getNodeRadius(tgt);
    const arrowX = tgt.x - Math.cos(angle) * (nodeR + 2);
    const arrowY = tgt.y - Math.sin(angle) * (nodeR + 2);
    const arrowLen = isHighlighted ? 5 : 4;

    ctx.beginPath();
    ctx.fillStyle = ctx.strokeStyle;
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

  ctx.restore();
}

// ─── Cluster Boundaries ─────────────────────────────────────────────────────

export function drawClusterBoundaries(
  ctx: CanvasRenderingContext2D,
  clusters: Map<string, { nodes: GraphNode[]; color: string; label: string }>
) {
  for (const [, cluster] of clusters) {
    if (cluster.nodes.length < 2) continue;

    let cx = 0, cy = 0;
    for (const n of cluster.nodes) { cx += n.x; cy += n.y; }
    cx /= cluster.nodes.length;
    cy /= cluster.nodes.length;

    let maxDist = 0;
    for (const n of cluster.nodes) {
      const d = Math.sqrt((n.x - cx) ** 2 + (n.y - cy) ** 2);
      if (d > maxDist) maxDist = d;
    }
    const padding = 30;
    const radius = maxDist + padding;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.fillStyle = `${cluster.color}08`;
    ctx.fill();
    ctx.strokeStyle = `${cluster.color}20`;
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = "600 10px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = `${cluster.color}60`;
    ctx.fillText(cluster.label, cx, cy - radius - 6);
    ctx.restore();
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function lightenHex(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `rgb(${r},${g},${b})`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}


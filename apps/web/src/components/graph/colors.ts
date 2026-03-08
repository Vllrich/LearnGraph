export const MASTERY_COLORS = [
  "#94a3b8", // 0 - Unknown (slate, not alarming)
  "#60a5fa", // 1 - Exposed
  "#a78bfa", // 2 - Practicing
  "#fbbf24", // 3 - Familiar
  "#34d399", // 4 - Proficient
  "#10b981", // 5 - Mastered
];

export const MASTERY_LABELS = [
  "Unknown",
  "Exposed",
  "Practicing",
  "Familiar",
  "Proficient",
  "Mastered",
];

export function retrievabilityColor(r: number): string {
  if (r >= 0.9) return "#10b981";
  if (r >= 0.7) return "#34d399";
  if (r >= 0.5) return "#fbbf24";
  if (r >= 0.3) return "#f97316";
  return "#ef4444";
}

export const DOMAIN_COLORS = [
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

export function domainColor(domain: string | null, allDomains: string[]): string {
  if (!domain) return "#71717a";
  const idx = allDomains.indexOf(domain);
  return DOMAIN_COLORS[idx % DOMAIN_COLORS.length];
}

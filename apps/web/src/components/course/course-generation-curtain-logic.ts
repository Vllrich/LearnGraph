import type { TeaserCard } from "@repo/ai";

/**
 * Pure helpers for <CourseGenerationCurtain /> extracted so they can
 * be unit-tested in the repo's node-only vitest env without pulling in
 * a DOM testing library.
 */

export type HeadlineStage = { untilMs: number; label: string };

export const HEADLINE_STAGES: readonly HeadlineStage[] = [
  { untilMs: 20_000, label: "Designing your modules…" },
  { untilMs: 40_000, label: "Shaping your first lessons…" },
  { untilMs: Number.POSITIVE_INFINITY, label: "Almost ready…" },
];

export function pickHeadlineLabel(
  elapsedMs: number,
  stages: readonly HeadlineStage[] = HEADLINE_STAGES,
): string {
  const found = stages.find((s) => elapsedMs < s.untilMs);
  return (found ?? stages[stages.length - 1]).label;
}

/**
 * Parses a single SSE frame (the text between two `\n\n` separators)
 * into its `event` name and parsed JSON `data`. Returns `null` if the
 * frame is malformed or doesn't concern us. Robust to the minor
 * formatting drift SSE parsers see in the wild (extra whitespace,
 * trailing newlines).
 */
export function parseSseFrame(
  frame: string,
): { event: string; data: unknown } | null {
  const eventMatch = frame.match(/^event:\s*(\S+)\s*$/m);
  const dataMatch = frame.match(/^data:\s*(.*)$/m);
  if (!eventMatch || !dataMatch) return null;
  try {
    return { event: eventMatch[1], data: JSON.parse(dataMatch[1]) };
  } catch {
    return null;
  }
}

/**
 * Splits a growing SSE buffer into completed frames and the trailing
 * partial remainder. Caller keeps the remainder and calls again as
 * more bytes arrive.
 */
export function splitSseBuffer(buffer: string): {
  frames: string[];
  rest: string;
} {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  return { frames: parts.filter((f) => f.length > 0), rest };
}

/**
 * Decides which set of cards the curtain should currently rotate
 * through. Prefers AI cards once at least `minAiCards` have streamed
 * in; otherwise falls back to the hand-authored generic set so the
 * user never sees an empty stage.
 */
export function pickActiveCards<T extends TeaserCard>(
  aiCards: readonly T[],
  generics: readonly T[],
  minAiCards = 2,
): readonly T[] {
  return aiCards.length >= minAiCards ? aiCards : generics;
}

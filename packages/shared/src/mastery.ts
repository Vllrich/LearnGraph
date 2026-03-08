import type { FSRSRating, MasteryLevel } from "./types";

/**
 * Compute new mastery level after a review event.
 * Rules (§5.6):
 * - Rating 3+ (Good/Easy): increment mastery (max 5)
 * - Rating 1 (Again): decrement mastery (min 0)
 * - Rating 2 (Hard): no change
 */
export function computeMastery(current: number, rating: FSRSRating): MasteryLevel {
  let next = current;
  if (rating >= 3 && current < 5) next = current + 1;
  if (rating === 1 && current > 0) next = current - 1;
  return Math.max(0, Math.min(5, next)) as MasteryLevel;
}

/**
 * Compute mastery from an explain-back success (highest boost).
 */
export function computeMasteryExplainBack(current: number, success: boolean): MasteryLevel {
  if (success) return Math.min(5, current + 2) as MasteryLevel;
  return Math.max(0, current - 1) as MasteryLevel;
}

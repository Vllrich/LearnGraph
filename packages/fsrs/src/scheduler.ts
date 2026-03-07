import type { FSRSRating } from "@repo/shared";
import type { Card, SchedulingResult, FSRSParameters } from "./types";
import { FSRS_DEFAULTS } from "./parameters";

/**
 * FSRS-5 scheduling algorithm.
 *
 * Implements the core FSRS formulas for stability, difficulty,
 * and interval calculation.
 */
export function schedule(
  card: Card,
  rating: FSRSRating,
  now: Date = new Date(),
  params: FSRSParameters = FSRS_DEFAULTS
): SchedulingResult {
  const { w, requestRetention, maximumInterval } = params;

  const elapsedDays =
    card.lastReview === null
      ? 0
      : (now.getTime() - card.lastReview.getTime()) / (1000 * 60 * 60 * 24);

  let newStability: number;
  let newDifficulty: number;
  let newState: Card["state"];
  let newReps = card.reps;
  let newLapses = card.lapses;

  if (card.state === "new") {
    newStability = initialStability(rating, w);
    newDifficulty = initialDifficulty(rating, w);
    newReps = 1;

    if (rating === 1) {
      newState = "learning";
      newLapses = 1;
    } else {
      newState = "review";
    }
  } else if (rating === 1) {
    // Lapse: forgot the card
    newLapses = card.lapses + 1;
    newDifficulty = nextDifficulty(card.difficulty, rating, w);
    newStability = nextForgetStability(
      card.difficulty,
      card.stability,
      getRetrievability(card, now),
      w
    );
    newState = "relearning";
    newReps = card.reps + 1;
  } else {
    // Successful review
    newDifficulty = nextDifficulty(card.difficulty, rating, w);
    newStability = nextRecallStability(
      card.difficulty,
      card.stability,
      getRetrievability(card, now),
      rating,
      w
    );
    newState = "review";
    newReps = card.reps + 1;
  }

  newDifficulty = clamp(newDifficulty, 1, 10);
  newStability = Math.max(newStability, 0.1);

  const interval = nextInterval(newStability, requestRetention, maximumInterval);

  const nextReview = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);

  const newCard: Card = {
    stability: newStability,
    difficulty: newDifficulty,
    elapsedDays,
    scheduledDays: interval,
    reps: newReps,
    lapses: newLapses,
    state: newState,
    lastReview: now,
  };

  return {
    card: newCard,
    nextReview,
    retrievability: getRetrievability(newCard, now),
  };
}

/** Predicted probability of correct recall right now (0–1). */
export function getRetrievability(card: Card, now: Date = new Date()): number {
  if (card.state === "new" || card.lastReview === null || card.stability <= 0) {
    return 0;
  }

  const elapsedDays =
    (now.getTime() - card.lastReview.getTime()) / (1000 * 60 * 60 * 24);

  return Math.pow(1 + (elapsedDays / (9 * card.stability)), -1);
}

// ── Internal FSRS-5 formulas ──

function initialStability(rating: FSRSRating, w: number[]): number {
  return Math.max(w[rating - 1], 0.1);
}

function initialDifficulty(rating: FSRSRating, w: number[]): number {
  return clamp(w[4] - Math.exp(w[5] * (rating - 1)) + 1, 1, 10);
}

function nextDifficulty(
  d: number,
  rating: FSRSRating,
  w: number[]
): number {
  const newD = w[7] * initialDifficulty(3, w) + (1 - w[7]) * (d - w[6] * (rating - 3));
  return clamp(newD, 1, 10);
}

function nextRecallStability(
  d: number,
  s: number,
  r: number,
  rating: FSRSRating,
  w: number[]
): number {
  const hardPenalty = rating === 2 ? w[15] : 1;
  const easyBonus = rating === 4 ? w[16] : 1;

  return (
    s *
    (1 +
      Math.exp(w[8]) *
        (11 - d) *
        Math.pow(s, -w[9]) *
        (Math.exp((1 - r) * w[10]) - 1) *
        hardPenalty *
        easyBonus)
  );
}

function nextForgetStability(
  d: number,
  s: number,
  r: number,
  w: number[]
): number {
  return (
    w[11] *
    Math.pow(d, -w[12]) *
    (Math.pow(s + 1, w[13]) - 1) *
    Math.exp((1 - r) * w[14])
  );
}

function nextInterval(
  stability: number,
  requestRetention: number,
  maximumInterval: number
): number {
  const interval = (stability / 9) * (Math.pow(1 / requestRetention, 1) - 1);
  return Math.min(Math.max(Math.round(interval), 1), maximumInterval);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

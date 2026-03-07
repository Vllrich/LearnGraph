import type { FSRSRating, FSRSState } from "@repo/shared";

export interface Card {
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: FSRSState;
  lastReview: Date | null;
}

export interface SchedulingResult {
  card: Card;
  nextReview: Date;
  retrievability: number;
}

export interface FSRSParameters {
  requestRetention: number;
  maximumInterval: number;
  w: number[];
}

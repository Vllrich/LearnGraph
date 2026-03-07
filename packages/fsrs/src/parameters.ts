import type { FSRSParameters } from "./types";

/**
 * FSRS-5 pretrained default parameters.
 * Source: https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm
 */
export const FSRS_DEFAULTS: FSRSParameters = {
  requestRetention: 0.9,
  maximumInterval: 36500,
  w: [
    0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0589, 1.5766,
    0.1772, 1.0278, 1.9265, 0.1071, 0.3150, 2.2504, 0.2529, 2.8890, 0.2003,
    0.6583,
  ],
};

export function newCard(): import("./types").Card {
  return {
    stability: 0,
    difficulty: 0,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    state: "new",
    lastReview: null,
  };
}

import { describe, it, expect } from "vitest";
import { computeMastery, computeMasteryExplainBack } from "./mastery";
import type { FSRSRating } from "./types";

describe("computeMastery", () => {
  it("increments mastery on Good (3)", () => {
    expect(computeMastery(0, 3)).toBe(1);
    expect(computeMastery(2, 3)).toBe(3);
    expect(computeMastery(4, 3)).toBe(5);
  });

  it("increments mastery on Easy (4)", () => {
    expect(computeMastery(0, 4)).toBe(1);
    expect(computeMastery(3, 4)).toBe(4);
  });

  it("decrements mastery on Again (1)", () => {
    expect(computeMastery(3, 1)).toBe(2);
    expect(computeMastery(5, 1)).toBe(4);
    expect(computeMastery(1, 1)).toBe(0);
  });

  it("does not change mastery on Hard (2)", () => {
    expect(computeMastery(0, 2)).toBe(0);
    expect(computeMastery(3, 2)).toBe(3);
    expect(computeMastery(5, 2)).toBe(5);
  });

  it("never goes below 0", () => {
    expect(computeMastery(0, 1)).toBe(0);
  });

  it("never goes above 5", () => {
    expect(computeMastery(5, 3)).toBe(5);
    expect(computeMastery(5, 4)).toBe(5);
  });

  it("handles all mastery levels with all ratings", () => {
    for (let m = 0; m <= 5; m++) {
      for (const r of [1, 2, 3, 4] as FSRSRating[]) {
        const result = computeMastery(m, r);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(5);
        expect(Number.isInteger(result)).toBe(true);
      }
    }
  });

  it("full lifecycle: 0 → 5 with consistent Good ratings", () => {
    let mastery = 0;
    for (let i = 0; i < 5; i++) {
      mastery = computeMastery(mastery, 3);
    }
    expect(mastery).toBe(5);
  });

  it("full lifecycle: 5 → 0 with consistent Again ratings", () => {
    let mastery = 5;
    for (let i = 0; i < 5; i++) {
      mastery = computeMastery(mastery, 1);
    }
    expect(mastery).toBe(0);
  });
});

describe("computeMasteryExplainBack", () => {
  it("gives +2 boost on success", () => {
    expect(computeMasteryExplainBack(0, true)).toBe(2);
    expect(computeMasteryExplainBack(3, true)).toBe(5);
  });

  it("caps at 5 on success", () => {
    expect(computeMasteryExplainBack(4, true)).toBe(5);
    expect(computeMasteryExplainBack(5, true)).toBe(5);
  });

  it("decrements on failure", () => {
    expect(computeMasteryExplainBack(3, false)).toBe(2);
    expect(computeMasteryExplainBack(0, false)).toBe(0);
  });
});

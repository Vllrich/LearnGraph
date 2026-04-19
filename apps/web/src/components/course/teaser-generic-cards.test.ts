import { describe, it, expect } from "vitest";
import { GENERIC_TEASER_CARDS, type TeaserCard } from "./teaser-generic-cards";

describe("GENERIC_TEASER_CARDS", () => {
  it("has at least 10 cards so rotation doesn't feel repetitive", () => {
    expect(GENERIC_TEASER_CARDS.length).toBeGreaterThanOrEqual(10);
  });

  it("every card has a 1-3 word keyword and a blurb <=140 chars", () => {
    for (const card of GENERIC_TEASER_CARDS) {
      const words = card.keyword.trim().split(/\s+/);
      expect(words.length).toBeGreaterThanOrEqual(1);
      expect(words.length).toBeLessThanOrEqual(3);
      expect(card.blurb.length).toBeGreaterThan(0);
      expect(card.blurb.length).toBeLessThanOrEqual(140);
    }
  });

  it("all keywords are unique (case-insensitive)", () => {
    const seen = new Set<string>();
    for (const card of GENERIC_TEASER_CARDS) {
      const key = card.keyword.toLowerCase();
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("exports a TeaserCard type compatible with the cards", () => {
    const sample: TeaserCard = GENERIC_TEASER_CARDS[0];
    expect(typeof sample.keyword).toBe("string");
    expect(typeof sample.blurb).toBe("string");
  });
});

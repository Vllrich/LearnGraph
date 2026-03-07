import { describe, it, expect } from "vitest";
import { schedule, getRetrievability } from "./scheduler";
import { newCard, FSRS_DEFAULTS } from "./parameters";
import type { Card } from "./types";
import type { FSRSRating } from "@repo/shared";

const NOW = new Date("2026-03-07T12:00:00Z");

function daysLater(days: number): Date {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);
}

describe("newCard", () => {
  it("returns a card in 'new' state with zeroed fields", () => {
    const card = newCard();
    expect(card.state).toBe("new");
    expect(card.stability).toBe(0);
    expect(card.difficulty).toBe(0);
    expect(card.reps).toBe(0);
    expect(card.lapses).toBe(0);
    expect(card.lastReview).toBeNull();
  });
});

describe("schedule — new card", () => {
  it.each([1, 2, 3, 4] as FSRSRating[])(
    "transitions new card with rating %i",
    (rating) => {
      const card = newCard();
      const result = schedule(card, rating, NOW);

      expect(result.card.reps).toBe(1);
      expect(result.card.lastReview).toEqual(NOW);
      expect(result.card.stability).toBeGreaterThan(0);
      expect(result.card.difficulty).toBeGreaterThanOrEqual(1);
      expect(result.card.difficulty).toBeLessThanOrEqual(10);
      expect(result.nextReview.getTime()).toBeGreaterThan(NOW.getTime());

      if (rating === 1) {
        expect(result.card.state).toBe("learning");
        expect(result.card.lapses).toBe(1);
      } else {
        expect(result.card.state).toBe("review");
        expect(result.card.lapses).toBe(0);
      }
    },
  );

  it("produces increasing stability for higher ratings on new cards", () => {
    const card = newCard();
    const s1 = schedule(card, 1, NOW).card.stability;
    const s2 = schedule(card, 2, NOW).card.stability;
    const s3 = schedule(card, 3, NOW).card.stability;
    const s4 = schedule(card, 4, NOW).card.stability;

    expect(s2).toBeGreaterThan(s1);
    expect(s3).toBeGreaterThan(s2);
    expect(s4).toBeGreaterThan(s3);
  });

  it("produces longer intervals for easier ratings", () => {
    const card = newCard();
    const i2 = schedule(card, 2, NOW).card.scheduledDays;
    const i3 = schedule(card, 3, NOW).card.scheduledDays;
    const i4 = schedule(card, 4, NOW).card.scheduledDays;

    expect(i3).toBeGreaterThanOrEqual(i2);
    expect(i4).toBeGreaterThanOrEqual(i3);
  });
});

describe("schedule — review card", () => {
  function reviewedCard(): Card {
    const card = newCard();
    return schedule(card, 3, NOW).card;
  }

  it("increments reps on successful review", () => {
    const card = reviewedCard();
    const result = schedule(card, 3, daysLater(card.scheduledDays));
    expect(result.card.reps).toBe(card.reps + 1);
    expect(result.card.state).toBe("review");
  });

  it("transitions to relearning on lapse (rating 1)", () => {
    const card = reviewedCard();
    const result = schedule(card, 1, daysLater(card.scheduledDays));
    expect(result.card.state).toBe("relearning");
    expect(result.card.lapses).toBe(card.lapses + 1);
  });

  it("gives hard penalty for rating 2 vs rating 3", () => {
    const card = reviewedCard();
    const reviewTime = daysLater(card.scheduledDays);
    const hardResult = schedule(card, 2, reviewTime);
    const goodResult = schedule(card, 3, reviewTime);

    expect(goodResult.card.stability).toBeGreaterThan(
      hardResult.card.stability,
    );
  });

  it("gives easy bonus for rating 4 vs rating 3", () => {
    const card = reviewedCard();
    const reviewTime = daysLater(card.scheduledDays);
    const goodResult = schedule(card, 3, reviewTime);
    const easyResult = schedule(card, 4, reviewTime);

    expect(easyResult.card.stability).toBeGreaterThan(
      goodResult.card.stability,
    );
  });
});

describe("schedule — state machine transitions", () => {
  it("new → learning (on Again)", () => {
    const result = schedule(newCard(), 1, NOW);
    expect(result.card.state).toBe("learning");
  });

  it("new → review (on Good)", () => {
    const result = schedule(newCard(), 3, NOW);
    expect(result.card.state).toBe("review");
  });

  it("review → relearning (on Again)", () => {
    const card = schedule(newCard(), 3, NOW).card;
    const result = schedule(card, 1, daysLater(card.scheduledDays));
    expect(result.card.state).toBe("relearning");
  });

  it("relearning → review (on Good)", () => {
    const card = schedule(newCard(), 3, NOW).card;
    const relCard = schedule(card, 1, daysLater(card.scheduledDays)).card;
    const result = schedule(relCard, 3, daysLater(card.scheduledDays + 1));
    expect(result.card.state).toBe("review");
  });
});

describe("schedule — difficulty clamping", () => {
  it("clamps difficulty between 1 and 10", () => {
    let card = newCard();
    for (let i = 0; i < 20; i++) {
      const result = schedule(card, 1, daysLater(i));
      expect(result.card.difficulty).toBeGreaterThanOrEqual(1);
      expect(result.card.difficulty).toBeLessThanOrEqual(10);
      card = result.card;
    }
  });

  it("clamps difficulty even with many easy ratings", () => {
    let card = newCard();
    for (let i = 0; i < 20; i++) {
      const result = schedule(card, 4, daysLater(i * 30));
      expect(result.card.difficulty).toBeGreaterThanOrEqual(1);
      expect(result.card.difficulty).toBeLessThanOrEqual(10);
      card = result.card;
    }
  });
});

describe("schedule — stability floor", () => {
  it("never produces stability below 0.1", () => {
    const card = newCard();
    const result = schedule(card, 1, NOW);
    expect(result.card.stability).toBeGreaterThanOrEqual(0.1);
  });
});

describe("schedule — maximum interval", () => {
  it("respects the maximum interval parameter", () => {
    const params = { ...FSRS_DEFAULTS, maximumInterval: 30 };
    let card = newCard();
    for (let i = 0; i < 10; i++) {
      const result = schedule(card, 4, daysLater(i * 30), params);
      expect(result.card.scheduledDays).toBeLessThanOrEqual(30);
      card = result.card;
    }
  });
});

describe("getRetrievability", () => {
  it("returns 0 for new cards", () => {
    expect(getRetrievability(newCard())).toBe(0);
  });

  it("returns ~1 immediately after review", () => {
    const card = schedule(newCard(), 3, NOW).card;
    const r = getRetrievability(card, NOW);
    expect(r).toBeGreaterThan(0.99);
  });

  it("decays over time", () => {
    const card = schedule(newCard(), 3, NOW).card;
    const rDay1 = getRetrievability(card, daysLater(1));
    const rDay7 = getRetrievability(card, daysLater(7));
    const rDay30 = getRetrievability(card, daysLater(30));

    expect(rDay1).toBeGreaterThan(rDay7);
    expect(rDay7).toBeGreaterThan(rDay30);
  });

  it("stays between 0 and 1", () => {
    const card = schedule(newCard(), 3, NOW).card;
    for (const days of [0.01, 1, 7, 30, 365, 3650]) {
      const r = getRetrievability(card, daysLater(days));
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1);
    }
  });

  it("returns 0 for cards with zero stability", () => {
    const card: Card = {
      ...newCard(),
      state: "review",
      stability: 0,
      lastReview: NOW,
    };
    expect(getRetrievability(card, daysLater(1))).toBe(0);
  });
});

describe("schedule — multi-review lifecycle", () => {
  it("produces increasing intervals with consistent Good ratings", () => {
    let card = newCard();
    const intervals: number[] = [];

    for (let i = 0; i < 5; i++) {
      const reviewDate =
        i === 0 ? NOW : daysLater(intervals.reduce((a, b) => a + b, 0));
      const result = schedule(card, 3, reviewDate);
      intervals.push(result.card.scheduledDays);
      card = result.card;
    }

    for (let i = 1; i < intervals.length; i++) {
      expect(intervals[i]).toBeGreaterThanOrEqual(intervals[i - 1]);
    }
  });
});

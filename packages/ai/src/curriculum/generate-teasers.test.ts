import { describe, it, expect } from "vitest";
import { TeaserCardSchema, buildTeaserPrompt } from "./generate-teasers";

describe("TeaserCardSchema", () => {
  it("accepts a well-formed card", () => {
    const parsed = TeaserCardSchema.parse({
      keyword: "Backpropagation",
      blurb: "The engine that makes neural nets learn.",
      moduleHint: "Module 3",
    });
    expect(parsed.keyword).toBe("Backpropagation");
    expect(parsed.moduleHint).toBe("Module 3");
  });

  it("accepts a card without a moduleHint", () => {
    const parsed = TeaserCardSchema.parse({
      keyword: "Vectors",
      blurb: "Arrows with a job to do in any dimension.",
    });
    expect(parsed.moduleHint).toBeUndefined();
  });

  it("rejects blurbs over 140 chars", () => {
    const long = "x".repeat(141);
    expect(() =>
      TeaserCardSchema.parse({ keyword: "A", blurb: long }),
    ).toThrow();
  });

  it("rejects keywords with more than 3 words", () => {
    expect(() =>
      TeaserCardSchema.parse({
        keyword: "one two three four",
        blurb: "ok",
      }),
    ).toThrow();
  });

  it("rejects an empty keyword after trim", () => {
    expect(() =>
      TeaserCardSchema.parse({ keyword: "   ", blurb: "ok" }),
    ).toThrow();
  });
});

describe("buildTeaserPrompt", () => {
  it("embeds topic, goal, and level into the prompt", () => {
    const prompt = buildTeaserPrompt({
      topic: "Neural networks",
      goalType: "skill_building",
      currentLevel: "some_knowledge",
    });
    expect(prompt).toContain("Neural networks");
    expect(prompt).toContain("skill_building");
    expect(prompt).toContain("some_knowledge");
  });

  it("includes education stage when provided", () => {
    const prompt = buildTeaserPrompt({
      topic: "French Revolution",
      goalType: "exploration",
      currentLevel: "beginner",
      educationStage: "high_school",
    });
    expect(prompt).toContain("high_school");
  });

  it("marks stage as unspecified when absent", () => {
    const prompt = buildTeaserPrompt({
      topic: "Baking",
      goalType: "exploration",
      currentLevel: "beginner",
    });
    expect(prompt).toContain("unspecified");
  });
});

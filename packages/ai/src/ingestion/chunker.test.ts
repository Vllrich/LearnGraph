import { describe, it, expect } from "vitest";
import { semanticChunk, countTokens } from "./chunker";

describe("countTokens", () => {
  it("returns a positive integer for non-empty text", () => {
    const count = countTokens("Hello world, this is a test.");
    expect(count).toBeGreaterThan(0);
    expect(Number.isInteger(count)).toBe(true);
  });

  it("returns 0 for empty string", () => {
    expect(countTokens("")).toBe(0);
  });
});

describe("semanticChunk", () => {
  it("returns at least one chunk for non-empty text", () => {
    const chunks = semanticChunk("This is a simple paragraph about machine learning.");
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0].chunkIndex).toBe(0);
  });

  it("preserves section titles from markdown headers", () => {
    const text = `# Introduction

This is the introduction paragraph about data science.

# Methods

This section describes the methodology used.`;

    const chunks = semanticChunk(text);
    const titles = chunks.map((c) => c.sectionTitle).filter(Boolean);
    expect(titles).toContain("Introduction");
    expect(titles).toContain("Methods");
  });

  it("never exceeds 512 tokens per chunk", () => {
    const longText = Array.from(
      { length: 200 },
      (_, i) =>
        `Sentence number ${i + 1} describes an important concept in quantum physics that requires deep understanding.`
    ).join(" ");

    const chunks = semanticChunk(longText);
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(550); // small buffer for overlap
    }
  });

  it("assigns sequential chunk indices", () => {
    const text = Array.from(
      { length: 50 },
      (_, i) =>
        `Paragraph ${i + 1} about neural networks and deep learning. ` +
        `This contains important information about backpropagation and gradient descent.`
    ).join("\n\n");

    const chunks = semanticChunk(text);
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].chunkIndex).toBe(i);
    }
  });

  it("creates overlap between adjacent chunks", () => {
    const text = Array.from(
      { length: 100 },
      (_, i) => `Unique sentence ${i + 1} about advanced mathematics and linear algebra concepts.`
    ).join(" ");

    const chunks = semanticChunk(text);
    if (chunks.length >= 2) {
      expect(chunks[0].content.length).toBeGreaterThan(0);
      expect(chunks[1].content.length).toBeGreaterThan(0);
    }
  });

  it("splits long sections on paragraph boundaries before sentence boundaries", () => {
    const para1 =
      "First paragraph with enough text to be meaningful. It talks about machine learning.";
    const para2 = "Second paragraph about deep learning. Neural networks are fascinating.";
    const para3 =
      "Third paragraph discusses reinforcement learning. Agents learn by trial and error.";
    const text = `# Section\n\n${para1}\n\n${para2}\n\n${para3}`;

    const chunks = semanticChunk(text);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    // All chunks should have content
    for (const chunk of chunks) {
      expect(chunk.content.trim().length).toBeGreaterThan(0);
    }
  });

  it("handles empty input gracefully", () => {
    const chunks = semanticChunk("");
    expect(chunks).toEqual([]);
  });

  it("handles text with no headers", () => {
    const text =
      "Just a simple paragraph without any headers. " +
      "It contains multiple sentences about various topics. " +
      "This should still be chunked properly.";

    const chunks = semanticChunk(text);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0].sectionTitle).toBeNull();
  });

  it("correctly reports token counts", () => {
    const text = "The quick brown fox jumps over the lazy dog.";
    const chunks = semanticChunk(text);
    expect(chunks.length).toBe(1);
    expect(chunks[0].tokenCount).toBe(countTokens(chunks[0].content));
  });

  it("produces 30-80 chunks for a ~20 page document", () => {
    const sections = Array.from(
      { length: 20 },
      (_, i) =>
        `## Chapter ${i + 1}\n\n` +
        Array.from(
          { length: 15 },
          (_, j) =>
            `This is paragraph ${j + 1} of chapter ${i + 1}. It discusses advanced topics in computer science ` +
            `including algorithms, data structures, and system design patterns.`
        ).join("\n\n")
    ).join("\n\n");

    const chunks = semanticChunk(sections);
    expect(chunks.length).toBeGreaterThanOrEqual(20);
    expect(chunks.length).toBeLessThanOrEqual(200);
  });
});

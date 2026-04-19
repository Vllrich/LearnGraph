import { describe, it, expect } from "vitest";
import {
  pickHeadlineLabel,
  parseSseFrame,
  splitSseBuffer,
  pickActiveCards,
} from "./course-generation-curtain-logic";

describe("pickHeadlineLabel", () => {
  it("returns the first-stage label just after start", () => {
    expect(pickHeadlineLabel(0)).toContain("Designing");
    expect(pickHeadlineLabel(5_000)).toContain("Designing");
  });

  it("transitions to the middle stage after 20s", () => {
    expect(pickHeadlineLabel(20_001)).toContain("Shaping");
  });

  it("transitions to the final stage after 40s", () => {
    expect(pickHeadlineLabel(45_000)).toContain("Almost");
    expect(pickHeadlineLabel(10 * 60_000)).toContain("Almost");
  });
});

describe("parseSseFrame", () => {
  it("parses a card event with JSON data", () => {
    const frame = `event: card\ndata: {"keyword":"Vectors","blurb":"ok"}`;
    const result = parseSseFrame(frame);
    expect(result).toEqual({
      event: "card",
      data: { keyword: "Vectors", blurb: "ok" },
    });
  });

  it("tolerates extra whitespace around the event name", () => {
    const frame = `event:  done   \ndata: {"ok":true}`;
    expect(parseSseFrame(frame)).toEqual({
      event: "done",
      data: { ok: true },
    });
  });

  it("returns null on malformed JSON", () => {
    const frame = `event: card\ndata: {not json`;
    expect(parseSseFrame(frame)).toBeNull();
  });

  it("returns null when the event line is missing", () => {
    const frame = `data: {"keyword":"x","blurb":"y"}`;
    expect(parseSseFrame(frame)).toBeNull();
  });
});

describe("splitSseBuffer", () => {
  it("returns no complete frames when buffer lacks a double-newline", () => {
    const { frames, rest } = splitSseBuffer("event: card\ndata: ");
    expect(frames).toEqual([]);
    expect(rest).toBe("event: card\ndata: ");
  });

  it("splits one complete frame from the trailing partial", () => {
    const buf = `event: card\ndata: {"k":1}\n\nevent: card\ndata: {"k":`;
    const { frames, rest } = splitSseBuffer(buf);
    expect(frames).toEqual([`event: card\ndata: {"k":1}`]);
    expect(rest).toBe(`event: card\ndata: {"k":`);
  });

  it("splits multiple complete frames", () => {
    const buf = `event: a\ndata: 1\n\nevent: b\ndata: 2\n\n`;
    const { frames, rest } = splitSseBuffer(buf);
    expect(frames).toEqual([`event: a\ndata: 1`, `event: b\ndata: 2`]);
    expect(rest).toBe("");
  });
});

describe("pickActiveCards", () => {
  const ai = [
    { keyword: "a", blurb: "a" },
    { keyword: "b", blurb: "b" },
  ];
  const generics = [
    { keyword: "g1", blurb: "g" },
    { keyword: "g2", blurb: "g" },
  ];

  it("returns generics when fewer AI cards than minAiCards have arrived", () => {
    expect(pickActiveCards([], generics)).toBe(generics);
    expect(pickActiveCards([ai[0]], generics)).toBe(generics);
  });

  it("returns AI cards once the threshold is hit", () => {
    expect(pickActiveCards(ai, generics)).toBe(ai);
  });

  it("respects a custom threshold", () => {
    const partial = [ai[0]];
    expect(pickActiveCards(partial, generics, 1)).toBe(partial);
  });
});

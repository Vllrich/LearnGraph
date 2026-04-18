import { describe, it, expect } from "vitest";
import { healthRouter } from "./health";
import { createCallerFactory } from "../init";

describe("healthRouter.check", () => {
  const createCaller = createCallerFactory(healthRouter);

  it("returns status ok with an ISO timestamp", async () => {
    const caller = createCaller({ db: {} as never, userId: null });
    const result = await caller.check();

    expect(result.status).toBe("ok");
    expect(typeof result.timestamp).toBe("string");
    expect(() => new Date(result.timestamp).toISOString()).not.toThrow();
    expect(new Date(result.timestamp).toString()).not.toBe("Invalid Date");
  });

  it("returns a fresh timestamp on each call", async () => {
    const caller = createCaller({ db: {} as never, userId: null });
    const a = await caller.check();
    await new Promise((r) => setTimeout(r, 2));
    const b = await caller.check();
    expect(Date.parse(b.timestamp)).toBeGreaterThanOrEqual(Date.parse(a.timestamp));
  });
});

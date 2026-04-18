import { describe, it, expect } from "vitest";
import { TRPCError } from "@trpc/server";
import { mentorRouter } from "./mentor";
import { createCallerFactory } from "../init";

describe("mentorRouter auth guard", () => {
  const createCaller = createCallerFactory(mentorRouter);

  it("rejects unauthenticated listConversations with UNAUTHORIZED", async () => {
    const caller = createCaller({ db: {} as never, userId: null });

    await expect(caller.listConversations()).rejects.toSatisfy((err: unknown) => {
      return err instanceof TRPCError && err.code === "UNAUTHORIZED";
    });
  });

  it("rejects unauthenticated getConversation with UNAUTHORIZED", async () => {
    const caller = createCaller({ db: {} as never, userId: null });

    await expect(
      caller.getConversation({ id: "00000000-0000-0000-0000-000000000000" }),
    ).rejects.toSatisfy((err: unknown) => {
      return err instanceof TRPCError && err.code === "UNAUTHORIZED";
    });
  });
});

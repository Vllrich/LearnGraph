import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import { listConversations, getConversation } from "@repo/ai";
import { TRPCError } from "@trpc/server";

export const mentorRouter = createTRPCRouter({
  listConversations: protectedProcedure.query(async ({ ctx }) => {
    return listConversations(ctx.userId);
  }),

  getConversation: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const conv = await getConversation(input.id, ctx.userId);
      if (!conv) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return conv;
    }),
});

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import { db, learningGoals } from "@repo/db";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const goalsRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select()
      .from(learningGoals)
      .where(eq(learningGoals.userId, ctx.userId))
      .orderBy(desc(learningGoals.createdAt));
  }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        description: z.string().max(2000).optional(),
        targetDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [goal] = await db
        .insert(learningGoals)
        .values({
          userId: ctx.userId,
          title: input.title,
          description: input.description,
          targetDate: input.targetDate,
          status: "active",
        })
        .returning();

      return goal;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(500).optional(),
        description: z.string().max(2000).optional(),
        targetDate: z.string().nullable().optional(),
        status: z.enum(["active", "completed", "paused"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      const [existing] = await db
        .select({ id: learningGoals.id })
        .from(learningGoals)
        .where(and(eq(learningGoals.id, id), eq(learningGoals.userId, ctx.userId)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const [updated] = await db
        .update(learningGoals)
        .set(updates)
        .where(eq(learningGoals.id, id))
        .returning();

      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select({ id: learningGoals.id })
        .from(learningGoals)
        .where(and(eq(learningGoals.id, input.id), eq(learningGoals.userId, ctx.userId)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await db.delete(learningGoals).where(eq(learningGoals.id, input.id));
      return { success: true };
    }),
});

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import { users } from "@repo/db";
import { eq } from "drizzle-orm";

export const userRouter = createTRPCRouter({
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const [user] = await ctx.db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        timezone: users.timezone,
        onboarding: users.onboarding,
        preferences: users.preferences,
      })
      .from(users)
      .where(eq(users.id, ctx.userId))
      .limit(1);

    return user ?? null;
  }),

  completeOnboarding: protectedProcedure
    .input(
      z.object({
        displayName: z.string().min(1).max(50),
        learningGoal: z.string().max(500).optional(),
        dailyBudget: z.number().min(5).max(50),
        timezone: z.string().max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(users)
        .set({
          displayName: input.displayName,
          timezone: input.timezone,
          onboarding: { completed: true, learningGoal: input.learningGoal },
          preferences: { dailyReviewBudget: input.dailyBudget },
          updatedAt: new Date(),
        })
        .where(eq(users.id, ctx.userId));

      return { success: true };
    }),

  updatePreferences: protectedProcedure
    .input(
      z.object({
        dailyReviewBudget: z.number().min(5).max(50).optional(),
        timezone: z.string().max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [user] = await ctx.db
        .select({ preferences: users.preferences })
        .from(users)
        .where(eq(users.id, ctx.userId))
        .limit(1);

      const currentPrefs =
        user?.preferences && typeof user.preferences === "object"
          ? (user.preferences as Record<string, unknown>)
          : {};

      await ctx.db
        .update(users)
        .set({
          preferences: { ...currentPrefs, ...input },
          ...(input.timezone ? { timezone: input.timezone } : {}),
          updatedAt: new Date(),
        })
        .where(eq(users.id, ctx.userId));

      return { success: true };
    }),
});

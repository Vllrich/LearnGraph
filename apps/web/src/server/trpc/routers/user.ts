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
        notifications: z
          .object({
            emailReminders: z.boolean().optional(),
            pushNotifications: z.boolean().optional(),
            reminderTime: z.string().optional(),
            quietHoursStart: z.string().optional(),
            quietHoursEnd: z.string().optional(),
            frequency: z.enum(["daily", "every_other_day", "weekly"]).optional(),
            smartNudges: z.boolean().optional(),
          })
          .optional(),
        mentorMemory: z.record(z.string(), z.unknown()).optional(),
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

      const { notifications, mentorMemory, ...rest } = input;
      const newPrefs = { ...currentPrefs, ...rest };

      if (notifications) {
        const existingNotifs =
          typeof currentPrefs.notifications === "object" ? currentPrefs.notifications : {};
        newPrefs.notifications = {
          ...(existingNotifs as Record<string, unknown>),
          ...notifications,
        };
      }

      if (mentorMemory) {
        const existingMemory =
          typeof currentPrefs.mentorMemory === "object" ? currentPrefs.mentorMemory : {};
        newPrefs.mentorMemory = { ...(existingMemory as Record<string, unknown>), ...mentorMemory };
      }

      await ctx.db
        .update(users)
        .set({
          preferences: newPrefs,
          ...(input.timezone ? { timezone: input.timezone } : {}),
          updatedAt: new Date(),
        })
        .where(eq(users.id, ctx.userId));

      return { success: true };
    }),

  getSessionContext: protectedProcedure.query(async ({ ctx }) => {
    const { userConceptState, reviewLog, learningGoals, concepts } = await import("@repo/db");
    const { eq, and, desc, gte, sql, count: countFn } = await import("drizzle-orm");

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentReviews = await ctx.db
      .select({
        conceptName: concepts.displayName,
        rating: reviewLog.rating,
        createdAt: reviewLog.createdAt,
      })
      .from(reviewLog)
      .innerJoin(concepts, eq(reviewLog.conceptId, concepts.id))
      .where(and(eq(reviewLog.userId, ctx.userId), gte(reviewLog.createdAt, sevenDaysAgo)))
      .orderBy(desc(reviewLog.createdAt))
      .limit(20);

    const masterySnapshot = await ctx.db
      .select({
        total: countFn(),
        mastered: countFn(sql`CASE WHEN ${userConceptState.masteryLevel} >= 4 THEN 1 END`),
        weak: countFn(sql`CASE WHEN ${userConceptState.masteryLevel} <= 1 THEN 1 END`),
      })
      .from(userConceptState)
      .where(eq(userConceptState.userId, ctx.userId));

    const weakConcepts = await ctx.db
      .select({ name: concepts.displayName })
      .from(userConceptState)
      .innerJoin(concepts, eq(userConceptState.conceptId, concepts.id))
      .where(
        and(
          eq(userConceptState.userId, ctx.userId),
          sql`COALESCE(${userConceptState.masteryLevel}, 0) <= 1`,
          sql`${userConceptState.fsrsReps} > 0`
        )
      )
      .limit(5);

    const strongConcepts = await ctx.db
      .select({ name: concepts.displayName })
      .from(userConceptState)
      .innerJoin(concepts, eq(userConceptState.conceptId, concepts.id))
      .where(
        and(eq(userConceptState.userId, ctx.userId), sql`${userConceptState.masteryLevel} >= 4`)
      )
      .limit(5);

    const activeGoals = await ctx.db
      .select({ title: learningGoals.title, status: learningGoals.status })
      .from(learningGoals)
      .where(and(eq(learningGoals.userId, ctx.userId), eq(learningGoals.status, "active")))
      .limit(5);

    const [user] = await ctx.db
      .select({ preferences: users.preferences })
      .from(users)
      .where(eq(users.id, ctx.userId))
      .limit(1);

    const prefs = (user?.preferences ?? {}) as Record<string, unknown>;
    const mentorMemory = (prefs.mentorMemory ?? {}) as Record<string, unknown>;

    return {
      masterySnapshot: masterySnapshot[0] ?? { total: 0, mastered: 0, weak: 0 },
      weakConcepts: weakConcepts.map((c) => c.name),
      strongConcepts: strongConcepts.map((c) => c.name),
      recentReviews: recentReviews.map((r) => ({
        concept: r.conceptName,
        rating: r.rating,
        date: r.createdAt,
      })),
      activeGoals: activeGoals.map((g) => g.title),
      mentorMemory,
    };
  }),
});

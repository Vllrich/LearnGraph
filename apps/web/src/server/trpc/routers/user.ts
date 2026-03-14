import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import { users, learnerProfiles } from "@repo/db";
import { eq } from "drizzle-orm";
import type { EducationStage, LearnerProfile } from "@repo/shared";

const DEFAULT_LEARNER_PROFILE: LearnerProfile = {
  educationStage: "self_learner",
  nativeLanguage: "en",
  contentLanguage: "en",
  communicationStyle: "balanced",
  explanationDepth: "standard",
  mentorTone: "encouraging",
  expertiseDomains: [],
  learningMotivations: [],
  accessibilityNeeds: {},
  inferredReadingLevel: null,
  inferredOptimalSessionMin: null,
  inferredBloomCeiling: null,
  inferredPace: null,
  calibrationConfidence: 0,
};

function rowToProfile(row: typeof learnerProfiles.$inferSelect): LearnerProfile {
  return {
    educationStage: row.educationStage as EducationStage,
    nativeLanguage: row.nativeLanguage,
    contentLanguage: row.contentLanguage,
    communicationStyle: row.communicationStyle as LearnerProfile["communicationStyle"],
    explanationDepth: row.explanationDepth as LearnerProfile["explanationDepth"],
    mentorTone: row.mentorTone as LearnerProfile["mentorTone"],
    expertiseDomains: row.expertiseDomains ?? [],
    learningMotivations: (row.learningMotivations ?? []) as LearnerProfile["learningMotivations"],
    accessibilityNeeds: (row.accessibilityNeeds ?? {}) as LearnerProfile["accessibilityNeeds"],
    inferredReadingLevel: row.inferredReadingLevel,
    inferredOptimalSessionMin: row.inferredOptimalSessionMin,
    inferredBloomCeiling: row.inferredBloomCeiling as LearnerProfile["inferredBloomCeiling"],
    inferredPace: row.inferredPace as LearnerProfile["inferredPace"],
    calibrationConfidence: row.calibrationConfidence ?? 0,
  };
}

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
        educationStage: z.enum(["elementary", "high_school", "university", "professional", "self_learner"]),
        learningGoal: z.string().max(500).optional(),
        dailyBudget: z.number().min(5).max(50),
        timezone: z.string().max(100),
        interestTopics: z.array(z.string().max(100)).max(20).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(users)
        .set({
          displayName: input.displayName,
          timezone: input.timezone,
          onboarding: { completed: true, learningGoal: input.learningGoal },
          preferences: {
            dailyReviewBudget: input.dailyBudget,
            learnerProfile: { educationStage: input.educationStage },
            interestTopics: input.interestTopics ?? [],
          },
          updatedAt: new Date(),
        })
        .where(eq(users.id, ctx.userId));

      return { success: true };
    }),

  saveTopicPreferences: protectedProcedure
    .input(
      z.object({
        interestTopics: z.array(z.string().max(100)).max(20),
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
          preferences: { ...currentPrefs, interestTopics: input.interestTopics },
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
        learnerProfile: z.object({
          educationStage: z.enum(["elementary", "high_school", "university", "professional", "self_learner"]),
        }).optional(),
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

      const { notifications, mentorMemory, learnerProfile, ...rest } = input;
      const newPrefs: Record<string, unknown> = { ...currentPrefs, ...rest };

      if (learnerProfile) {
        newPrefs.learnerProfile = learnerProfile;
      }

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

    const [recentReviews, masterySnapshotArr, weakConcepts, strongConcepts, activeGoals, user] =
      await Promise.all([
        ctx.db
          .select({
            conceptName: concepts.displayName,
            rating: reviewLog.rating,
            createdAt: reviewLog.createdAt,
          })
          .from(reviewLog)
          .innerJoin(concepts, eq(reviewLog.conceptId, concepts.id))
          .where(and(eq(reviewLog.userId, ctx.userId), gte(reviewLog.createdAt, sevenDaysAgo)))
          .orderBy(desc(reviewLog.createdAt))
          .limit(20),
        ctx.db
          .select({
            total: countFn(),
            mastered: countFn(sql`CASE WHEN ${userConceptState.masteryLevel} >= 4 THEN 1 END`),
            weak: countFn(sql`CASE WHEN ${userConceptState.masteryLevel} <= 1 THEN 1 END`),
          })
          .from(userConceptState)
          .where(eq(userConceptState.userId, ctx.userId)),
        ctx.db
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
          .limit(5),
        ctx.db
          .select({ name: concepts.displayName })
          .from(userConceptState)
          .innerJoin(concepts, eq(userConceptState.conceptId, concepts.id))
          .where(
            and(eq(userConceptState.userId, ctx.userId), sql`${userConceptState.masteryLevel} >= 4`)
          )
          .limit(5),
        ctx.db
          .select({ title: learningGoals.title, status: learningGoals.status })
          .from(learningGoals)
          .where(and(eq(learningGoals.userId, ctx.userId), eq(learningGoals.status, "active")))
          .limit(5),
        ctx.db
          .select({ preferences: users.preferences })
          .from(users)
          .where(eq(users.id, ctx.userId))
          .limit(1)
          .then((rows) => rows[0]),
      ]);

    const prefs = (user?.preferences ?? {}) as Record<string, unknown>;
    const mentorMemory = (prefs.mentorMemory ?? {}) as Record<string, unknown>;

    return {
      masterySnapshot: masterySnapshotArr[0] ?? { total: 0, mastered: 0, weak: 0 },
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

  getLearnerProfile: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select()
      .from(learnerProfiles)
      .where(eq(learnerProfiles.userId, ctx.userId))
      .limit(1);

    if (row) return rowToProfile(row);

    // Auto-seed from legacy preferences.learnerProfile if it exists
    const [user] = await ctx.db
      .select({ preferences: users.preferences })
      .from(users)
      .where(eq(users.id, ctx.userId))
      .limit(1);

    const prefs = (user?.preferences ?? {}) as Record<string, unknown>;
    const legacy = prefs.learnerProfile as { educationStage?: string } | undefined;
    const stage = (legacy?.educationStage ?? "self_learner") as EducationStage;

    const [seeded] = await ctx.db
      .insert(learnerProfiles)
      .values({ userId: ctx.userId, educationStage: stage })
      .onConflictDoNothing()
      .returning();

    return seeded ? rowToProfile(seeded) : DEFAULT_LEARNER_PROFILE;
  }),

  updateLearnerProfile: protectedProcedure
    .input(
      z.object({
        educationStage: z
          .enum(["elementary", "high_school", "university", "professional", "self_learner"])
          .optional(),
        nativeLanguage: z.string().min(2).max(10).optional(),
        contentLanguage: z.string().min(2).max(10).optional(),
        communicationStyle: z.enum(["casual", "balanced", "formal"]).optional(),
        explanationDepth: z.enum(["concise", "standard", "thorough"]).optional(),
        mentorTone: z.enum(["encouraging", "neutral", "challenging"]).optional(),
        expertiseDomains: z.array(z.string().max(100)).max(20).optional(),
        learningMotivations: z
          .array(z.enum(["career", "curiosity", "exam", "hobby", "academic"]))
          .max(5)
          .optional(),
        accessibilityNeeds: z
          .object({
            dyslexia: z.boolean().optional(),
            adhd: z.boolean().optional(),
            visualImpairment: z.boolean().optional(),
            reducedMotion: z.boolean().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const setFields: Record<string, unknown> = { updatedAt: new Date() };

      if (input.educationStage !== undefined) setFields.educationStage = input.educationStage;
      if (input.nativeLanguage !== undefined) setFields.nativeLanguage = input.nativeLanguage;
      if (input.contentLanguage !== undefined) setFields.contentLanguage = input.contentLanguage;
      if (input.communicationStyle !== undefined) setFields.communicationStyle = input.communicationStyle;
      if (input.explanationDepth !== undefined) setFields.explanationDepth = input.explanationDepth;
      if (input.mentorTone !== undefined) setFields.mentorTone = input.mentorTone;
      if (input.expertiseDomains !== undefined) setFields.expertiseDomains = input.expertiseDomains;
      if (input.learningMotivations !== undefined) setFields.learningMotivations = input.learningMotivations;
      if (input.accessibilityNeeds !== undefined) setFields.accessibilityNeeds = input.accessibilityNeeds;

      // Upsert: create if missing, update if exists
      await ctx.db
        .insert(learnerProfiles)
        .values({ userId: ctx.userId, ...setFields })
        .onConflictDoUpdate({
          target: learnerProfiles.userId,
          set: setFields,
        });

      // Keep legacy preferences.learnerProfile in sync for backward compat
      if (input.educationStage) {
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
            preferences: {
              ...currentPrefs,
              learnerProfile: { educationStage: input.educationStage },
            },
            updatedAt: new Date(),
          })
          .where(eq(users.id, ctx.userId));
      }

      return { success: true };
    }),
});

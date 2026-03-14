import { z } from "zod";
import crypto from "crypto";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../init";
import {
  db,
  learningGoals,
  curriculumItems,
  sharedCurriculums,
  courseModules,
  courseLessons,
  lessonBlocks,
  userConceptState,
  reviewLog,
  userStreaks,
  userAchievements,
  users,
} from "@repo/db";
import { eq, and, desc, asc, sql, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  getNextLesson as getNextLessonEngine,
  getCourseRoadmap as getCourseRoadmapEngine,
  isModuleSkipEligible,
  generateCatchUpSuggestion,
  getWelcomeBackSuggestion,
} from "@repo/ai";
import { schedule, newCard } from "@repo/fsrs";
import type { AchievementKey } from "@repo/shared";
import { ACHIEVEMENT_DEFINITIONS, XP_VALUES } from "@repo/shared";

// ---------------------------------------------------------------------------
// Helpers for FSRS + gamification integration (shared with gamification router)
// ---------------------------------------------------------------------------

function getTodayStr(tz: string): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: tz });
}

async function ensureStreak(userId: string) {
  const [existing] = await db
    .select()
    .from(userStreaks)
    .where(eq(userStreaks.userId, userId))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(userStreaks)
    .values({ userId, currentStreak: 0, longestStreak: 0, totalXp: 0 })
    .returning();
  return created;
}

async function grantAchievementIfNew(userId: string, key: AchievementKey): Promise<boolean> {
  const def = ACHIEVEMENT_DEFINITIONS.find((a) => a.key === key);
  if (!def) return false;
  try {
    await db.insert(userAchievements).values({ userId, achievementKey: key });
    await db
      .update(userStreaks)
      .set({ totalXp: sql`COALESCE(${userStreaks.totalXp}, 0) + ${def.xp}`, updatedAt: new Date() })
      .where(eq(userStreaks.userId, userId));
    return true;
  } catch {
    return false;
  }
}

function blockRatingFromType(blockType: string, interactionLog: unknown): number {
  if (blockType === "checkpoint" || blockType === "practice") {
    const log = interactionLog as Record<string, unknown> | undefined;
    if (log?.correct === true) return 4;
    if (log?.correct === false) return 2;
  }
  if (blockType === "concept" || blockType === "worked_example") return 3;
  return 3;
}

async function updateConceptStateFromBlock(
  userId: string,
  conceptIds: string[],
  blockType: string,
  interactionLog: unknown,
) {
  const rating = blockRatingFromType(blockType, interactionLog);
  const now = new Date();

  for (const conceptId of conceptIds) {
    const [existing] = await db
      .select()
      .from(userConceptState)
      .where(and(eq(userConceptState.userId, userId), eq(userConceptState.conceptId, conceptId)))
      .limit(1);

    const card = existing
      ? {
          stability: existing.fsrsStability ?? 0,
          difficulty: existing.fsrsDifficulty ?? 5,
          elapsedDays: existing.fsrsElapsedDays ?? 0,
          scheduledDays: existing.fsrsScheduledDays ?? 0,
          reps: existing.fsrsReps ?? 0,
          lapses: existing.fsrsLapses ?? 0,
          state: (existing.fsrsState ?? "new") as "new" | "learning" | "review" | "relearning",
          lastReview: existing.lastReviewAt,
        }
      : newCard();

    const result = schedule(card, rating as 1 | 2 | 3 | 4, now);
    const masteryLevel = Math.min(5, Math.floor(result.retrievability * 5 + 0.5));

    if (existing) {
      await db
        .update(userConceptState)
        .set({
          fsrsStability: result.card.stability,
          fsrsDifficulty: result.card.difficulty,
          fsrsElapsedDays: result.card.elapsedDays,
          fsrsScheduledDays: result.card.scheduledDays,
          fsrsRetrievability: result.retrievability,
          fsrsState: result.card.state,
          fsrsReps: result.card.reps,
          fsrsLapses: result.card.lapses,
          lastReviewAt: now,
          nextReviewAt: result.nextReview,
          masteryLevel,
          updatedAt: now,
        })
        .where(eq(userConceptState.id, existing.id));
    } else {
      await db.insert(userConceptState).values({
        userId,
        conceptId,
        fsrsStability: result.card.stability,
        fsrsDifficulty: result.card.difficulty,
        fsrsElapsedDays: result.card.elapsedDays,
        fsrsScheduledDays: result.card.scheduledDays,
        fsrsRetrievability: result.retrievability,
        fsrsState: result.card.state,
        fsrsReps: result.card.reps,
        fsrsLapses: result.card.lapses,
        lastReviewAt: now,
        nextReviewAt: result.nextReview,
        masteryLevel,
      });
    }

    await db.insert(reviewLog).values({
      userId,
      conceptId,
      rating,
      reviewType: `block_${blockType}`,
    });
  }
}

async function recordBlockActivity(userId: string) {
  const streak = await ensureStreak(userId);
  const [userRow] = await db
    .select({ timezone: users.timezone })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const tz = userRow?.timezone ?? "UTC";
  const today = getTodayStr(tz);
  const xpGain = XP_VALUES.review;
  const isNewDay = streak.lastActivityDate !== today;

  const updates: Record<string, unknown> = {
    totalXp: sql`COALESCE(${userStreaks.totalXp}, 0) + ${xpGain}`,
    updatedAt: new Date(),
  };

  if (isNewDay) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString("sv-SE", { timeZone: tz });
    const isConsecutive = streak.lastActivityDate === yesterdayStr;

    if (isConsecutive || !streak.lastActivityDate) {
      const newStreak = (streak.currentStreak ?? 0) + 1;
      updates.currentStreak = newStreak;
      updates.longestStreak = sql`GREATEST(COALESCE(${userStreaks.longestStreak}, 0), ${newStreak})`;
    } else {
      updates.currentStreak = 1;
    }
    updates.lastActivityDate = today;
  }

  await db.update(userStreaks).set(updates).where(eq(userStreaks.id, streak.id));
}

async function checkCourseAchievements(userId: string, goalId: string) {
  const completedModules = await db
    .select({ cnt: count() })
    .from(courseModules)
    .where(and(eq(courseModules.goalId, goalId), eq(courseModules.status, "completed")));
  const moduleCount = Number(completedModules[0]?.cnt ?? 0);

  if (moduleCount >= 1) await grantAchievementIfNew(userId, "first_module_complete");
  if (moduleCount >= 5) await grantAchievementIfNew(userId, "modules_5");
  if (moduleCount >= 10) await grantAchievementIfNew(userId, "modules_10");

  const allModules = await db
    .select({ status: courseModules.status })
    .from(courseModules)
    .where(eq(courseModules.goalId, goalId));
  const courseComplete = allModules.length > 0 && allModules.every(
    (m) => m.status === "completed" || m.status === "skipped",
  );
  if (courseComplete) await grantAchievementIfNew(userId, "first_course_complete");

  const totalBlocks = await db
    .select({ cnt: count() })
    .from(lessonBlocks)
    .innerJoin(courseLessons, eq(lessonBlocks.lessonId, courseLessons.id))
    .innerJoin(courseModules, eq(courseLessons.moduleId, courseModules.id))
    .where(and(eq(courseModules.goalId, goalId), eq(lessonBlocks.status, "completed")));
  const blockCount = Number(totalBlocks[0]?.cnt ?? 0);
  if (blockCount >= 50) await grantAchievementIfNew(userId, "blocks_50");
  if (blockCount >= 100) await grantAchievementIfNew(userId, "blocks_100");
}

export const goalsRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select()
      .from(learningGoals)
      .where(eq(learningGoals.userId, ctx.userId))
      .orderBy(desc(learningGoals.createdAt));
  }),

  getActive: protectedProcedure.query(async ({ ctx }) => {
    const goals = await db
      .select()
      .from(learningGoals)
      .where(and(eq(learningGoals.userId, ctx.userId), eq(learningGoals.status, "active")))
      .orderBy(desc(learningGoals.createdAt));

    const result = await Promise.all(
      goals.map(async (goal) => {
        const items = await db
          .select()
          .from(curriculumItems)
          .where(eq(curriculumItems.goalId, goal.id))
          .orderBy(asc(curriculumItems.sequenceOrder));

        const completed = items.filter((i) => i.status === "completed").length;
        const nextItem = items.find((i) => i.status !== "completed");

        return { ...goal, totalItems: items.length, completedItems: completed, nextItem };
      })
    );

    return result;
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [goal] = await db
        .select()
        .from(learningGoals)
        .where(and(eq(learningGoals.id, input.id), eq(learningGoals.userId, ctx.userId)))
        .limit(1);

      if (!goal) throw new TRPCError({ code: "NOT_FOUND" });

      const items = await db
        .select()
        .from(curriculumItems)
        .where(eq(curriculumItems.goalId, goal.id))
        .orderBy(asc(curriculumItems.sequenceOrder));

      return { ...goal, items };
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        description: z.string().max(2000).optional(),
        targetDate: z.string().optional(),
        goalType: z
          .enum(["exam_prep", "skill_building", "course_supplement", "exploration"])
          .optional(),
        currentLevel: z.enum(["beginner", "some_knowledge", "experienced"]).optional(),
        timeBudgetMinutes: z.number().min(5).max(480).optional(),
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
          goalType: input.goalType,
          currentLevel: input.currentLevel,
          timeBudgetMinutes: input.timeBudgetMinutes,
          status: "active",
        })
        .returning();

      return goal;
    }),

  completeCurriculumItem: protectedProcedure
    .input(z.object({ itemId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [item] = await db
        .select({ id: curriculumItems.id, goalId: curriculumItems.goalId })
        .from(curriculumItems)
        .innerJoin(learningGoals, eq(curriculumItems.goalId, learningGoals.id))
        .where(and(eq(curriculumItems.id, input.itemId), eq(learningGoals.userId, ctx.userId)))
        .limit(1);

      if (!item) throw new TRPCError({ code: "NOT_FOUND" });

      const [updated] = await db
        .update(curriculumItems)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(curriculumItems.id, input.itemId))
        .returning();

      return updated;
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

  shareCurriculum: protectedProcedure
    .input(z.object({ goalId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [goal] = await db
        .select()
        .from(learningGoals)
        .where(and(eq(learningGoals.id, input.goalId), eq(learningGoals.userId, ctx.userId)))
        .limit(1);

      if (!goal) throw new TRPCError({ code: "NOT_FOUND" });

      const [existing] = await db
        .select()
        .from(sharedCurriculums)
        .where(eq(sharedCurriculums.goalId, input.goalId))
        .limit(1);

      if (existing) return { shareToken: existing.shareToken };

      const items = await db
        .select({
          title: curriculumItems.title,
          description: curriculumItems.description,
          sequenceOrder: curriculumItems.sequenceOrder,
          estimatedMinutes: curriculumItems.estimatedMinutes,
          learningMethod: curriculumItems.learningMethod,
        })
        .from(curriculumItems)
        .where(eq(curriculumItems.goalId, input.goalId))
        .orderBy(asc(curriculumItems.sequenceOrder));

      const token = crypto.randomBytes(16).toString("hex");

      await db.insert(sharedCurriculums).values({
        goalId: input.goalId,
        shareToken: token,
        title: goal.title,
        description: goal.description,
        items: items,
        createdByUserId: ctx.userId,
      });

      return { shareToken: token };
    }),

  getSharedCurriculum: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ input }) => {
      const [shared] = await db
        .select()
        .from(sharedCurriculums)
        .where(eq(sharedCurriculums.shareToken, input.token))
        .limit(1);

      if (!shared) throw new TRPCError({ code: "NOT_FOUND" });

      await db
        .update(sharedCurriculums)
        .set({ viewCount: sql`COALESCE(${sharedCurriculums.viewCount}, 0) + 1` })
        .where(eq(sharedCurriculums.id, shared.id));

      return {
        title: shared.title,
        description: shared.description,
        items: shared.items as Array<{
          title: string;
          description: string | null;
          sequenceOrder: number;
          estimatedMinutes: number | null;
          learningMethod: string | null;
        }>,
        viewCount: (shared.viewCount ?? 0) + 1,
        createdAt: shared.createdAt,
      };
    }),

  // ---------------------------------------------------------------------------
  // V2 Modular Course Procedures
  // ---------------------------------------------------------------------------

  getNextLesson: protectedProcedure
    .input(z.object({ goalId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [goal] = await db
        .select({ id: learningGoals.id })
        .from(learningGoals)
        .where(and(eq(learningGoals.id, input.goalId), eq(learningGoals.userId, ctx.userId)))
        .limit(1);

      if (!goal) throw new TRPCError({ code: "NOT_FOUND" });

      return getNextLessonEngine(input.goalId, ctx.userId);
    }),

  getCourseRoadmap: protectedProcedure
    .input(z.object({ goalId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [goal] = await db
        .select()
        .from(learningGoals)
        .where(and(eq(learningGoals.id, input.goalId), eq(learningGoals.userId, ctx.userId)))
        .limit(1);

      if (!goal) throw new TRPCError({ code: "NOT_FOUND" });

      const roadmap = await getCourseRoadmapEngine(input.goalId, ctx.userId);
      return { goal, modules: roadmap };
    }),

  getLessonBlocks: protectedProcedure
    .input(z.object({ lessonId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [lesson] = await db
        .select()
        .from(courseLessons)
        .where(eq(courseLessons.id, input.lessonId))
        .limit(1);

      if (!lesson) throw new TRPCError({ code: "NOT_FOUND" });

      // Verify ownership through module → goal chain
      const [mod] = await db
        .select()
        .from(courseModules)
        .where(eq(courseModules.id, lesson.moduleId))
        .limit(1);
      if (!mod) throw new TRPCError({ code: "NOT_FOUND" });

      const [goal] = await db
        .select({ id: learningGoals.id })
        .from(learningGoals)
        .where(and(eq(learningGoals.id, mod.goalId), eq(learningGoals.userId, ctx.userId)))
        .limit(1);
      if (!goal) throw new TRPCError({ code: "NOT_FOUND" });

      const blocks = await db
        .select()
        .from(lessonBlocks)
        .where(eq(lessonBlocks.lessonId, input.lessonId))
        .orderBy(asc(lessonBlocks.sequenceOrder));

      return { lesson, blocks };
    }),

  completeBlock: protectedProcedure
    .input(z.object({
      blockId: z.string().uuid(),
      interactionLog: z.unknown().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [block] = await db
        .select()
        .from(lessonBlocks)
        .where(eq(lessonBlocks.id, input.blockId))
        .limit(1);

      if (!block) throw new TRPCError({ code: "NOT_FOUND" });

      // Verify ownership
      const [lesson] = await db
        .select()
        .from(courseLessons)
        .where(eq(courseLessons.id, block.lessonId))
        .limit(1);
      if (!lesson) throw new TRPCError({ code: "NOT_FOUND" });

      const [mod] = await db
        .select()
        .from(courseModules)
        .where(eq(courseModules.id, lesson.moduleId))
        .limit(1);
      if (!mod) throw new TRPCError({ code: "NOT_FOUND" });

      const [goal] = await db
        .select({ id: learningGoals.id })
        .from(learningGoals)
        .where(and(eq(learningGoals.id, mod.goalId), eq(learningGoals.userId, ctx.userId)))
        .limit(1);
      if (!goal) throw new TRPCError({ code: "NOT_FOUND" });

      const [updated] = await db
        .update(lessonBlocks)
        .set({
          status: "completed",
          completedAt: new Date(),
          interactionLog: input.interactionLog ?? block.interactionLog,
        })
        .where(eq(lessonBlocks.id, input.blockId))
        .returning();

      // FSRS: update concept state + review log for block's concepts
      const conceptIds = (block.conceptIds ?? []).filter(Boolean) as string[];
      if (conceptIds.length > 0) {
        await updateConceptStateFromBlock(ctx.userId, conceptIds, block.blockType, input.interactionLog);
      }

      // Streak + XP
      await recordBlockActivity(ctx.userId);

      // Check if all blocks in this lesson are complete
      const allBlocks = await db
        .select({ status: lessonBlocks.status })
        .from(lessonBlocks)
        .where(eq(lessonBlocks.lessonId, block.lessonId));

      const allComplete = allBlocks.every(
        (b) => b.status === "completed" || b.status === "skipped",
      );

      if (allComplete) {
        await db
          .update(courseLessons)
          .set({ status: "completed", completedAt: new Date() })
          .where(eq(courseLessons.id, block.lessonId));

        const allLessons = await db
          .select({ status: courseLessons.status })
          .from(courseLessons)
          .where(eq(courseLessons.moduleId, lesson.moduleId));

        const moduleComplete = allLessons.every(
          (l) => l.status === "completed" || l.status === "skipped",
        );

        if (moduleComplete) {
          await db
            .update(courseModules)
            .set({ status: "completed", completedAt: new Date() })
            .where(eq(courseModules.id, lesson.moduleId));

          await checkCourseAchievements(ctx.userId, mod.goalId);
        }
      }

      return { block: updated, lessonComplete: allComplete };
    }),

  skipModule: protectedProcedure
    .input(z.object({ moduleId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [mod] = await db
        .select()
        .from(courseModules)
        .where(eq(courseModules.id, input.moduleId))
        .limit(1);

      if (!mod) throw new TRPCError({ code: "NOT_FOUND" });

      const [goal] = await db
        .select({ id: learningGoals.id })
        .from(learningGoals)
        .where(and(eq(learningGoals.id, mod.goalId), eq(learningGoals.userId, ctx.userId)))
        .limit(1);
      if (!goal) throw new TRPCError({ code: "NOT_FOUND" });

      const eligible = await isModuleSkipEligible(input.moduleId, ctx.userId);
      if (!eligible) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Module is not eligible for skipping. Concept mastery too low.",
        });
      }

      await db
        .update(courseModules)
        .set({ status: "skipped", completedAt: new Date() })
        .where(eq(courseModules.id, input.moduleId));

      // Mark all lessons and blocks as skipped
      const lessons = await db
        .select({ id: courseLessons.id })
        .from(courseLessons)
        .where(eq(courseLessons.moduleId, input.moduleId));

      for (const lesson of lessons) {
        await db
          .update(courseLessons)
          .set({ status: "skipped", completedAt: new Date() })
          .where(eq(courseLessons.id, lesson.id));

        await db
          .update(lessonBlocks)
          .set({ status: "skipped", completedAt: new Date() })
          .where(eq(lessonBlocks.lessonId, lesson.id));
      }

      return { success: true };
    }),

  getCourseProgress: protectedProcedure
    .input(z.object({ goalId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [goal] = await db
        .select()
        .from(learningGoals)
        .where(and(eq(learningGoals.id, input.goalId), eq(learningGoals.userId, ctx.userId)))
        .limit(1);

      if (!goal) throw new TRPCError({ code: "NOT_FOUND" });

      const modules = await db
        .select()
        .from(courseModules)
        .where(eq(courseModules.goalId, input.goalId));

      const totalModules = modules.length;
      const completedModules = modules.filter(
        (m) => m.status === "completed" || m.status === "skipped",
      ).length;

      let totalBlocks = 0;
      let completedBlocks = 0;

      for (const mod of modules) {
        const lessons = await db
          .select({ id: courseLessons.id })
          .from(courseLessons)
          .where(eq(courseLessons.moduleId, mod.id));

        for (const lesson of lessons) {
          const blocks = await db
            .select({ status: lessonBlocks.status })
            .from(lessonBlocks)
            .where(eq(lessonBlocks.lessonId, lesson.id));

          totalBlocks += blocks.length;
          completedBlocks += blocks.filter(
            (b) => b.status === "completed" || b.status === "skipped",
          ).length;
        }
      }

      return {
        totalModules,
        completedModules,
        totalBlocks,
        completedBlocks,
        moduleProgress: totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0,
        blockProgress: totalBlocks > 0 ? Math.round((completedBlocks / totalBlocks) * 100) : 0,
        isComplete: completedModules === totalModules && totalModules > 0,
      };
    }),

  getCatchUpSuggestion: protectedProcedure
    .input(z.object({ goalId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [goal] = await db
        .select({ id: learningGoals.id })
        .from(learningGoals)
        .where(and(eq(learningGoals.id, input.goalId), eq(learningGoals.userId, ctx.userId)))
        .limit(1);
      if (!goal) throw new TRPCError({ code: "NOT_FOUND" });
      return generateCatchUpSuggestion(input.goalId, ctx.userId);
    }),

  getWelcomeBack: protectedProcedure
    .query(async ({ ctx }) => {
      return getWelcomeBackSuggestion(ctx.userId);
    }),
});

import { z } from "zod";
import { after } from "next/server";
import { createTRPCRouter, protectedProcedure } from "../init";
import {
  db,
  learningGoals,
  courseModules,
  courseLessons,
  lessonBlocks,
  userConceptState,
  reviewLog,
  userStreaks,
  userAchievements,
  users,
} from "@repo/db";
import { eq, and, desc, asc, sql, count, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
const getAiPathEngine = () => import("@repo/ai").then((m) => ({
  getNextLesson: m.getNextLesson,
  getCourseRoadmap: m.getCourseRoadmap,
  isModuleSkipEligible: m.isModuleSkipEligible,
  generateCatchUpSuggestion: m.generateCatchUpSuggestion,
  getWelcomeBackSuggestion: m.getWelcomeBackSuggestion,
}));
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
  if (conceptIds.length === 0) return;
  const rating = blockRatingFromType(blockType, interactionLog);
  const now = new Date();

  // Batch read: single query for all concept states
  const existingStates = await db
    .select()
    .from(userConceptState)
    .where(
      and(
        eq(userConceptState.userId, userId),
        inArray(userConceptState.conceptId, conceptIds),
      ),
    );
  const existingMap = new Map(existingStates.map((s) => [s.conceptId, s]));

  const toInsert: (typeof userConceptState.$inferInsert)[] = [];
  const reviewRows: (typeof reviewLog.$inferInsert)[] = [];

  for (const conceptId of conceptIds) {
    const existing = existingMap.get(conceptId);

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

    const fields = {
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
    };

    if (existing) {
      // Update existing — must be individual since we key by id
      await db
        .update(userConceptState)
        .set(fields)
        .where(eq(userConceptState.id, existing.id));
    } else {
      toInsert.push({ userId, conceptId, ...fields });
    }

    reviewRows.push({ userId, conceptId, rating, reviewType: `block_${blockType}` });
  }

  // Batch insert new concept states + review logs
  const ops: Promise<unknown>[] = [];
  if (toInsert.length > 0) {
    ops.push(db.insert(userConceptState).values(toInsert));
  }
  if (reviewRows.length > 0) {
    ops.push(db.insert(reviewLog).values(reviewRows));
  }
  await Promise.all(ops);
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
  const [completedModules, allModules, totalBlocks] = await Promise.all([
    db
      .select({ cnt: count() })
      .from(courseModules)
      .where(and(eq(courseModules.goalId, goalId), eq(courseModules.status, "completed")))
      .then((rows) => rows[0]),
    db
      .select({ status: courseModules.status })
      .from(courseModules)
      .where(eq(courseModules.goalId, goalId)),
    db
      .select({ cnt: count() })
      .from(lessonBlocks)
      .innerJoin(courseLessons, eq(lessonBlocks.lessonId, courseLessons.id))
      .innerJoin(courseModules, eq(courseLessons.moduleId, courseModules.id))
      .where(and(eq(courseModules.goalId, goalId), eq(lessonBlocks.status, "completed")))
      .then((rows) => rows[0]),
  ]);

  const moduleCount = Number(completedModules?.cnt ?? 0);
  if (moduleCount >= 1) await grantAchievementIfNew(userId, "first_module_complete");
  if (moduleCount >= 5) await grantAchievementIfNew(userId, "modules_5");
  if (moduleCount >= 10) await grantAchievementIfNew(userId, "modules_10");

  const courseComplete = allModules.length > 0 && allModules.every(
    (m) => m.status === "completed" || m.status === "skipped",
  );
  if (courseComplete) await grantAchievementIfNew(userId, "first_course_complete");

  const blockCount = Number(totalBlocks?.cnt ?? 0);
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

    if (goals.length === 0) return [];

    const goalIds = goals.map((g) => g.id);

    const [blockRows, nextLessonRows] = await Promise.all([
      db
        .select({
          goalId: courseModules.goalId,
          blockStatus: lessonBlocks.status,
        })
        .from(lessonBlocks)
        .innerJoin(courseLessons, eq(courseLessons.id, lessonBlocks.lessonId))
        .innerJoin(courseModules, eq(courseModules.id, courseLessons.moduleId))
        .where(inArray(courseModules.goalId, goalIds)),
      db
        .select({
          goalId: courseModules.goalId,
          lessonId: courseLessons.id,
          title: courseLessons.title,
          moduleOrder: courseModules.sequenceOrder,
          lessonOrder: courseLessons.sequenceOrder,
          lessonStatus: courseLessons.status,
        })
        .from(courseLessons)
        .innerJoin(courseModules, eq(courseModules.id, courseLessons.moduleId))
        .where(inArray(courseModules.goalId, goalIds))
        .orderBy(asc(courseModules.sequenceOrder), asc(courseLessons.sequenceOrder)),
    ]);

    const blockStatsByGoal = new Map<string, { total: number; completed: number }>();
    for (const row of blockRows) {
      const stats = blockStatsByGoal.get(row.goalId) ?? { total: 0, completed: 0 };
      stats.total++;
      if (row.blockStatus === "completed" || row.blockStatus === "skipped") stats.completed++;
      blockStatsByGoal.set(row.goalId, stats);
    }

    const nextLessonByGoal = new Map<string, { id: string; title: string }>();
    for (const row of nextLessonRows) {
      if (nextLessonByGoal.has(row.goalId)) continue;
      if (row.lessonStatus === "completed" || row.lessonStatus === "skipped") continue;
      nextLessonByGoal.set(row.goalId, { id: row.lessonId, title: row.title });
    }

    return goals.map((goal) => {
      const stats = blockStatsByGoal.get(goal.id) ?? { total: 0, completed: 0 };
      const nextItem = nextLessonByGoal.get(goal.id) ?? null;
      return {
        ...goal,
        totalItems: stats.total,
        completedItems: stats.completed,
        nextItem,
      };
    });
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

      return goal;
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

      const { getNextLesson: getNextLessonEngine } = await getAiPathEngine();
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

      const { getCourseRoadmap: getCourseRoadmapEngine } = await getAiPathEngine();
      const roadmap = await getCourseRoadmapEngine(input.goalId, ctx.userId);
      return { goal, modules: roadmap };
    }),

  getLessonBlocks: protectedProcedure
    .input(z.object({ lessonId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Single-query ownership check: lesson → module → goal → user.
      // Also pull `generation_status` so the player can distinguish "blocks
      // not yet persisted (Phase 2 still running)" from "Phase 2 failed"
      // and stop polling in the failed case.
      const [lessonRow] = await db
        .select({
          id: courseLessons.id,
          moduleId: courseLessons.moduleId,
          title: courseLessons.title,
          status: courseLessons.status,
          sequenceOrder: courseLessons.sequenceOrder,
          createdAt: courseLessons.createdAt,
          completedAt: courseLessons.completedAt,
          goalGenerationStatus: learningGoals.generationStatus,
        })
        .from(courseLessons)
        .innerJoin(courseModules, eq(courseModules.id, courseLessons.moduleId))
        .innerJoin(learningGoals, eq(learningGoals.id, courseModules.goalId))
        .where(
          and(
            eq(courseLessons.id, input.lessonId),
            eq(learningGoals.userId, ctx.userId),
          ),
        )
        .limit(1);

      if (!lessonRow) throw new TRPCError({ code: "NOT_FOUND" });

      const blocks = await db
        .select()
        .from(lessonBlocks)
        .where(eq(lessonBlocks.lessonId, input.lessonId))
        .orderBy(asc(lessonBlocks.sequenceOrder));

      // Lesson-open warm-up: materialize every still-pending block for this
      // lesson so the player can stream from cached JSONB with no LLM latency.
      //
      // Scheduled via `after()` (runs once the tRPC response has flushed) so
      // the caller isn't blocked and — critically — so the runtime reliably
      // keeps the function alive until the writes land. The previous
      // `import(...).then(...).catch(() => {})` was a true detached promise and
      // could be killed mid-flight on serverless, leaving blocks pending.
      const pendingBlocks = blocks
        .filter((b) => (b.generatedContent as Record<string, unknown>)?._pending)
        .map((b) => ({
          id: b.id,
          blockType: b.blockType,
          generatedContent: b.generatedContent,
        }));

      if (pendingBlocks.length > 0) {
        const [goalRow] = await db
          .select({ title: learningGoals.title })
          .from(courseModules)
          .innerJoin(learningGoals, eq(learningGoals.id, courseModules.goalId))
          .where(eq(courseModules.id, lessonRow.moduleId))
          .limit(1);

        if (goalRow) {
          const courseTopic = goalRow.title;
          after(async () => {
            try {
              const { preGeneratePendingBlocks } = await import("@repo/ai");
              // concurrency=3 keeps warm-up fast while staying well under
              // Anthropic TPM limits for a single-user burst.
              await preGeneratePendingBlocks(pendingBlocks, courseTopic, {
                concurrency: 3,
              });
            } catch (err) {
              console.error("[getLessonBlocks] warm-up failed:", err);
            }
          });
        }
      }

      return { lesson: lessonRow, blocks };
    }),

  completeBlock: protectedProcedure
    .input(z.object({
      blockId: z.string().uuid(),
      interactionLog: z.unknown().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Single-query ownership: block → lesson → module → goal → user
      const [blockRow] = await db
        .select({
          id: lessonBlocks.id,
          lessonId: lessonBlocks.lessonId,
          blockType: lessonBlocks.blockType,
          conceptIds: lessonBlocks.conceptIds,
          interactionLog: lessonBlocks.interactionLog,
          sequenceOrder: lessonBlocks.sequenceOrder,
          status: lessonBlocks.status,
          generatedContent: lessonBlocks.generatedContent,
          moduleId: courseLessons.moduleId,
          goalId: courseModules.goalId,
        })
        .from(lessonBlocks)
        .innerJoin(courseLessons, eq(courseLessons.id, lessonBlocks.lessonId))
        .innerJoin(courseModules, eq(courseModules.id, courseLessons.moduleId))
        .innerJoin(learningGoals, eq(learningGoals.id, courseModules.goalId))
        .where(
          and(
            eq(lessonBlocks.id, input.blockId),
            eq(learningGoals.userId, ctx.userId),
          ),
        )
        .limit(1);

      if (!blockRow) throw new TRPCError({ code: "NOT_FOUND" });

      const block = blockRow;

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
          .where(eq(courseLessons.moduleId, block.moduleId));

        const moduleComplete = allLessons.every(
          (l) => l.status === "completed" || l.status === "skipped",
        );

        if (moduleComplete) {
          await db
            .update(courseModules)
            .set({ status: "completed", completedAt: new Date() })
            .where(eq(courseModules.id, block.moduleId));

          await checkCourseAchievements(ctx.userId, block.goalId);
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

      const { isModuleSkipEligible } = await getAiPathEngine();
      const eligible = await isModuleSkipEligible(input.moduleId, ctx.userId);
      if (!eligible) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Module is not eligible for skipping. Concept mastery too low.",
        });
      }

      const skipTime = new Date();
      const lessons = await db
        .select({ id: courseLessons.id })
        .from(courseLessons)
        .where(eq(courseLessons.moduleId, input.moduleId));
      const lessonIds = lessons.map((l) => l.id);

      // Batch: update module, all lessons, all blocks in parallel
      await Promise.all([
        db
          .update(courseModules)
          .set({ status: "skipped", completedAt: skipTime })
          .where(eq(courseModules.id, input.moduleId)),
        lessonIds.length > 0
          ? db
              .update(courseLessons)
              .set({ status: "skipped", completedAt: skipTime })
              .where(inArray(courseLessons.id, lessonIds))
          : Promise.resolve(),
        lessonIds.length > 0
          ? db
              .update(lessonBlocks)
              .set({ status: "skipped", completedAt: skipTime })
              .where(inArray(lessonBlocks.lessonId, lessonIds))
          : Promise.resolve(),
      ]);

      return { success: true };
    }),

  /**
   * Retry generation for a single failed module.
   *
   * The generation job runs under Next.js `after()` so the tRPC response
   * flushes immediately and the client starts receiving SSE events as soon
   * as the row flips to `generating`. Idempotent at the module row level:
   * `regenerateSingleModule` short-circuits if the module is already
   * `ready`, and `runSingleModuleJob` atomically bumps `generation_attempt`
   * on entry so concurrent retries converge on a single in-flight job.
   */
  retryModuleGeneration: protectedProcedure
    .input(z.object({ moduleId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [mod] = await db
        .select({
          id: courseModules.id,
          goalId: courseModules.goalId,
          generationStatus: courseModules.generationStatus,
        })
        .from(courseModules)
        .innerJoin(learningGoals, eq(learningGoals.id, courseModules.goalId))
        .where(
          and(
            eq(courseModules.id, input.moduleId),
            eq(learningGoals.userId, ctx.userId),
          ),
        )
        .limit(1);

      if (!mod) throw new TRPCError({ code: "NOT_FOUND" });
      if (mod.generationStatus === "ready") {
        return { status: "ready" as const };
      }
      if (mod.generationStatus === "generating") {
        // Already in flight — just reflect current state.
        return { status: "generating" as const };
      }

      // Fire-and-forget the regeneration so this mutation returns fast and
      // the client transitions to a "retrying..." state via SSE as soon as
      // `runSingleModuleJob` flips the row to `generating`.
      after(async () => {
        try {
          const { regenerateSingleModule } = await import("@repo/ai");
          await regenerateSingleModule({
            goalId: mod.goalId,
            moduleId: mod.id,
          });
        } catch (err) {
          // `regenerateSingleModule` already persists the failure reason on
          // the module row and recomputes goal-level status. This catch is
          // just a last-chance log so nothing silently swallows the error.
          console.error("[goals.retryModuleGeneration] background job threw:", err);
        }
      });

      return { status: "retrying" as const };
    }),

  getCourseProgress: protectedProcedure
    .input(z.object({ goalId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [goal] = await db
        .select({ id: learningGoals.id })
        .from(learningGoals)
        .where(and(eq(learningGoals.id, input.goalId), eq(learningGoals.userId, ctx.userId)))
        .limit(1);

      if (!goal) throw new TRPCError({ code: "NOT_FOUND" });

      // Single joined query: modules → lessons → blocks, aggregate in JS
      const [modules, blockRows] = await Promise.all([
        db
          .select({ id: courseModules.id, status: courseModules.status })
          .from(courseModules)
          .where(eq(courseModules.goalId, input.goalId)),
        db
          .select({ blockStatus: lessonBlocks.status })
          .from(lessonBlocks)
          .innerJoin(courseLessons, eq(courseLessons.id, lessonBlocks.lessonId))
          .innerJoin(courseModules, eq(courseModules.id, courseLessons.moduleId))
          .where(eq(courseModules.goalId, input.goalId)),
      ]);

      const totalModules = modules.length;
      const completedModules = modules.filter(
        (m) => m.status === "completed" || m.status === "skipped",
      ).length;

      const totalBlocks = blockRows.length;
      const completedBlocks = blockRows.filter(
        (b) => b.blockStatus === "completed" || b.blockStatus === "skipped",
      ).length;

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
      const { generateCatchUpSuggestion } = await getAiPathEngine();
      return generateCatchUpSuggestion(input.goalId, ctx.userId);
    }),

  getWelcomeBack: protectedProcedure
    .query(async ({ ctx }) => {
      const { getWelcomeBackSuggestion } = await getAiPathEngine();
      return getWelcomeBackSuggestion(ctx.userId);
    }),
});

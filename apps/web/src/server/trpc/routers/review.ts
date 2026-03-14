import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import {
  db,
  userConceptState,
  reviewLog,
  questions,
  userAnswers,
  concepts,
  conceptChunkLinks,
  contentChunks,
  users,
  learningObjects,
  learningGoals,
  curriculumItems,
} from "@repo/db";
import { eq, and, lte, sql, asc, desc, count, inArray, gte } from "drizzle-orm";
import { schedule, newCard, type Card } from "@repo/fsrs";
import type { FSRSRating } from "@repo/shared";
import {
  DEFAULT_DAILY_REVIEW_LIMIT,
  DEFAULT_REVIEW_MIX_RATIO,
  QUICK_5_LIMIT,
  computeMastery,
  computeMasteryExplainBack,
} from "@repo/shared";

function dbStateToCard(state: typeof userConceptState.$inferSelect): Card {
  return {
    stability: state.fsrsStability ?? 0,
    difficulty: state.fsrsDifficulty ?? 5.0,
    elapsedDays: state.fsrsElapsedDays ?? 0,
    scheduledDays: state.fsrsScheduledDays ?? 0,
    reps: state.fsrsReps ?? 0,
    lapses: state.fsrsLapses ?? 0,
    state: (state.fsrsState as Card["state"]) ?? "new",
    lastReview: state.lastReviewAt,
  };
}

function cardToDbFields(card: Card, nextReview: Date, retrievability: number) {
  return {
    fsrsStability: card.stability,
    fsrsDifficulty: card.difficulty,
    fsrsElapsedDays: card.elapsedDays,
    fsrsScheduledDays: card.scheduledDays,
    fsrsRetrievability: retrievability,
    fsrsState: card.state,
    fsrsReps: card.reps,
    fsrsLapses: card.lapses,
    lastReviewAt: new Date(),
    nextReviewAt: nextReview,
    updatedAt: new Date(),
  };
}

export const reviewRouter = createTRPCRouter({
  /**
   * Initialize user_concept_state rows for concepts linked to a learning object.
   * Called when a user first views content — sets mastery to 1 (Exposed).
   * Uses ON CONFLICT DO NOTHING to avoid overwriting existing state.
   */
  initConceptStates: protectedProcedure
    .input(z.object({ learningObjectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const linkedConcepts = await db
        .selectDistinct({ conceptId: conceptChunkLinks.conceptId })
        .from(conceptChunkLinks)
        .innerJoin(contentChunks, eq(conceptChunkLinks.chunkId, contentChunks.id))
        .where(eq(contentChunks.learningObjectId, input.learningObjectId));

      if (linkedConcepts.length === 0) return { initialized: 0 };

      const conceptIds = linkedConcepts.map((c) => c.conceptId);

      const existing = await db
        .select({ conceptId: userConceptState.conceptId })
        .from(userConceptState)
        .where(
          and(
            eq(userConceptState.userId, ctx.userId),
            inArray(userConceptState.conceptId, conceptIds)
          )
        );
      const existingSet = new Set(existing.map((e) => e.conceptId));
      const newConceptIds = conceptIds.filter((id) => !existingSet.has(id));

      if (newConceptIds.length === 0) return { initialized: 0 };

      const now = new Date();
      await db.insert(userConceptState).values(
        newConceptIds.map((conceptId) => ({
          userId: ctx.userId,
          conceptId,
          masteryLevel: 1,
          fsrsState: "new" as const,
          nextReviewAt: now,
          createdAt: now,
          updatedAt: now,
        }))
      );

      return { initialized: newConceptIds.length };
    }),

  /**
   * Daily review queue: 80% due reviews (sorted by lowest retrievability)
   * + 20% new concepts (never reviewed, sorted by creation date).
   */
  getDailyQueue: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(50).optional(),
          mode: z.enum(["standard", "quick_5", "interleaved"]).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const mode = input?.mode ?? "standard";
      const budget =
        mode === "quick_5" ? QUICK_5_LIMIT : (input?.limit ?? DEFAULT_DAILY_REVIEW_LIMIT);
      const reviewSlots = Math.ceil(budget * DEFAULT_REVIEW_MIX_RATIO.review);
      const newSlots = budget - reviewSlots;
      const now = new Date();

      const [dueItems, newItems] = await Promise.all([
        db
          .select({
            id: userConceptState.id,
            conceptId: userConceptState.conceptId,
            masteryLevel: userConceptState.masteryLevel,
            fsrsRetrievability: userConceptState.fsrsRetrievability,
            nextReviewAt: userConceptState.nextReviewAt,
            conceptName: concepts.displayName,
            conceptDefinition: concepts.definition,
            conceptDifficulty: concepts.difficultyLevel,
            domain: concepts.domain,
          })
          .from(userConceptState)
          .innerJoin(concepts, eq(userConceptState.conceptId, concepts.id))
          .where(
            and(
              eq(userConceptState.userId, ctx.userId),
              lte(userConceptState.nextReviewAt, now),
              sql`${userConceptState.fsrsReps} > 0`
            )
          )
          .orderBy(asc(userConceptState.fsrsRetrievability))
          .limit(reviewSlots),
        db
          .select({
            id: userConceptState.id,
            conceptId: userConceptState.conceptId,
            masteryLevel: userConceptState.masteryLevel,
            fsrsRetrievability: userConceptState.fsrsRetrievability,
            nextReviewAt: userConceptState.nextReviewAt,
            conceptName: concepts.displayName,
            conceptDefinition: concepts.definition,
            conceptDifficulty: concepts.difficultyLevel,
            domain: concepts.domain,
          })
          .from(userConceptState)
          .innerJoin(concepts, eq(userConceptState.conceptId, concepts.id))
          .where(and(eq(userConceptState.userId, ctx.userId), sql`${userConceptState.fsrsReps} = 0`))
          .orderBy(asc(userConceptState.createdAt))
          .limit(newSlots),
      ]);

      let allItems = [...dueItems, ...newItems];

      // Smart queue: interleave domains so consecutive items differ
      if (mode === "interleaved" && allItems.length > 2) {
        const byDomain = new Map<string, typeof allItems>();
        for (const item of allItems) {
          const domain = item.domain ?? "__none__";
          const list = byDomain.get(domain) ?? [];
          list.push(item);
          byDomain.set(domain, list);
        }
        const interleaved: typeof allItems = [];
        const domainQueues = Array.from(byDomain.values());
        let idx = 0;
        while (interleaved.length < allItems.length) {
          const queue = domainQueues[idx % domainQueues.length];
          if (queue.length > 0) interleaved.push(queue.shift()!);
          idx++;
          if (domainQueues.every((q) => q.length === 0)) break;
        }
        allItems = interleaved;
      }

      // Difficulty ramping: easy → hard → easy (warm-up → peak → cool-down)
      if (allItems.length >= 5 && mode !== "quick_5") {
        const sorted = [...allItems].sort(
          (a, b) => (a.conceptDifficulty ?? 3) - (b.conceptDifficulty ?? 3)
        );
        const third = Math.ceil(sorted.length / 3);
        const easy = sorted.slice(0, third);
        const hard = sorted.slice(third, third * 2);
        const mid = sorted.slice(third * 2);
        allItems = [...easy, ...hard, ...mid];
      }

      const conceptIds = allItems.map((d) => d.conceptId);

      let questionsForReview: (typeof questions.$inferSelect)[] = [];
      if (conceptIds.length > 0) {
        const masteryMap = new Map<string, number>();
        for (const item of allItems) {
          masteryMap.set(item.conceptId, item.masteryLevel ?? 0);
        }

        const allQuestions = await db
          .select()
          .from(questions)
          .where(
            sql`${questions.conceptIds} && ARRAY[${sql.join(
              conceptIds.map((id) => sql`${id}::uuid`),
              sql`, `
            )}] AND COALESCE(${questions.isExcluded}, false) = false`
          )
          .limit(budget * 5);

        questionsForReview = allQuestions
          .map((q) => {
            const conceptId = q.conceptIds?.[0];
            const mastery = conceptId ? (masteryMap.get(conceptId) ?? 0) : 0;
            const targetDifficulty = Math.min(5, Math.max(1, mastery + 1));
            const diffDelta = Math.abs((q.difficulty ?? 3) - targetDifficulty);
            return { ...q, _sortScore: diffDelta };
          })
          .sort((a, b) => a._sortScore - b._sortScore)
          .slice(0, budget * 2)
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          .map(({ _sortScore: _, ...q }) => q);
      }

      // Flag high-mastery concepts eligible for explain-back
      const explainBackEligible = allItems
        .filter((item) => (item.masteryLevel ?? 0) >= 3)
        .map((item) => item.conceptId);

      return {
        items: allItems,
        questions: questionsForReview,
        totalDue: dueItems.length,
        totalNew: newItems.length,
        mode,
        explainBackEligible,
      };
    }),

  submitReview: protectedProcedure
    .input(
      z.object({
        conceptId: z.string().uuid(),
        rating: z.number().min(1).max(4) as z.ZodType<FSRSRating>,
        questionId: z.string().uuid().optional(),
        answerText: z.string().optional(),
        isCorrect: z.boolean().optional(),
        responseTimeMs: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [state] = await db
        .select()
        .from(userConceptState)
        .where(
          and(
            eq(userConceptState.userId, ctx.userId),
            eq(userConceptState.conceptId, input.conceptId)
          )
        )
        .limit(1);

      const card = state ? dbStateToCard(state) : newCard();
      const result = schedule(card, input.rating);
      const newMastery = computeMastery(state?.masteryLevel ?? 0, input.rating);

      if (state) {
        await db
          .update(userConceptState)
          .set({
            masteryLevel: newMastery,
            ...cardToDbFields(result.card, result.nextReview, result.retrievability),
          })
          .where(eq(userConceptState.id, state.id));
      } else {
        await db.insert(userConceptState).values({
          userId: ctx.userId,
          conceptId: input.conceptId,
          masteryLevel: newMastery,
          ...cardToDbFields(result.card, result.nextReview, result.retrievability),
        });
      }

      await db.insert(reviewLog).values({
        userId: ctx.userId,
        conceptId: input.conceptId,
        rating: input.rating,
        reviewType: input.questionId ? "quiz" : "self_rate",
        questionId: input.questionId,
        responseTimeMs: input.responseTimeMs,
      });

      if (input.questionId && input.answerText !== undefined) {
        await db.insert(userAnswers).values({
          userId: ctx.userId,
          questionId: input.questionId,
          answerText: input.answerText,
          isCorrect: input.isCorrect,
        });
      }

      return {
        newMastery,
        nextReview: result.nextReview,
        retrievability: result.retrievability,
      };
    }),

  submitExplainBack: protectedProcedure
    .input(
      z.object({
        conceptId: z.string().uuid(),
        explanation: z.string().min(10).max(5000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [state] = await db
        .select()
        .from(userConceptState)
        .where(
          and(
            eq(userConceptState.userId, ctx.userId),
            eq(userConceptState.conceptId, input.conceptId)
          )
        )
        .limit(1);

      const [concept] = await db
        .select({ name: concepts.displayName, definition: concepts.definition })
        .from(concepts)
        .where(eq(concepts.id, input.conceptId))
        .limit(1);

      if (!concept) return { success: false, feedback: "Concept not found." };

      const { evaluateExplainBackResponse } = await import("@repo/ai");

      const evaluation = await evaluateExplainBackResponse(
        concept.name,
        concept.definition,
        input.explanation
      );

      const isSuccess = evaluation.overallScore >= 60;
      const newMastery = computeMasteryExplainBack(state?.masteryLevel ?? 0, isSuccess);

      if (state) {
        const card = dbStateToCard(state);
        const fsrsResult = schedule(card, isSuccess ? 4 : 2);
        await db
          .update(userConceptState)
          .set({
            masteryLevel: newMastery,
            ...cardToDbFields(fsrsResult.card, fsrsResult.nextReview, fsrsResult.retrievability),
          })
          .where(eq(userConceptState.id, state.id));
      }

      await db.insert(reviewLog).values({
        userId: ctx.userId,
        conceptId: input.conceptId,
        rating: isSuccess ? 4 : 2,
        reviewType: "explain_back",
      });

      return {
        success: isSuccess,
        evaluation,
        newMastery,
      };
    }),

  getStats: protectedProcedure.query(async ({ ctx }) => {
    const [masteryDistArr, recentReviews, userRow] = await Promise.all([
      db
        .select({
          total: count(),
          m0: count(sql`CASE WHEN ${userConceptState.masteryLevel} = 0 THEN 1 END`),
          m1: count(sql`CASE WHEN ${userConceptState.masteryLevel} = 1 THEN 1 END`),
          m2: count(sql`CASE WHEN ${userConceptState.masteryLevel} = 2 THEN 1 END`),
          m3: count(sql`CASE WHEN ${userConceptState.masteryLevel} = 3 THEN 1 END`),
          m4: count(sql`CASE WHEN ${userConceptState.masteryLevel} = 4 THEN 1 END`),
          m5: count(sql`CASE WHEN ${userConceptState.masteryLevel} = 5 THEN 1 END`),
        })
        .from(userConceptState)
        .where(eq(userConceptState.userId, ctx.userId)),
      db
        .select({
          id: reviewLog.id,
          rating: reviewLog.rating,
          reviewType: reviewLog.reviewType,
          createdAt: reviewLog.createdAt,
          conceptName: concepts.displayName,
        })
        .from(reviewLog)
        .innerJoin(concepts, eq(reviewLog.conceptId, concepts.id))
        .where(eq(reviewLog.userId, ctx.userId))
        .orderBy(desc(reviewLog.createdAt))
        .limit(50),
      db
        .select({ timezone: users.timezone })
        .from(users)
        .where(eq(users.id, ctx.userId))
        .limit(1)
        .then((rows) => rows[0]),
    ]);

    const masteryDist = masteryDistArr[0];
    const tz = userRow?.timezone ?? "UTC";

    const streakResult = await db.execute<{ streak_days: number }>(sql`
      WITH daily_reviews AS (
        SELECT DISTINCT DATE(created_at AT TIME ZONE ${tz}) as review_date
        FROM review_log
        WHERE user_id = ${ctx.userId}
        ORDER BY review_date DESC
      ),
      streak AS (
        SELECT review_date,
               review_date - (ROW_NUMBER() OVER (ORDER BY review_date DESC))::int * INTERVAL '1 day' as grp
        FROM daily_reviews
      )
      SELECT COUNT(*)::int as streak_days
      FROM streak
      WHERE grp = (SELECT grp FROM streak LIMIT 1)
    `);

    const streak =
      Array.isArray(streakResult) && streakResult.length > 0
        ? Number(streakResult[0].streak_days)
        : 0;

    return {
      mastery: masteryDist ?? { total: 0, m0: 0, m1: 0, m2: 0, m3: 0, m4: 0, m5: 0 },
      recentReviews,
      streak,
    };
  }),

  /**
   * Practice exam: timed set of random questions from the user's studied content.
   * No hints, no immediate feedback — simulates real exam conditions.
   */
  getPracticeExam: protectedProcedure
    .input(
      z.object({
        questionCount: z.number().min(1).max(100).default(20),
        timeLimitMinutes: z.number().min(5).max(240).default(60),
        learningObjectIds: z.array(z.string().uuid()).optional(),
        goalIds: z.array(z.string().uuid()).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(learningObjects.userId, ctx.userId),
        eq(learningObjects.status, "ready"),
        sql`COALESCE(${questions.isExcluded}, false) = false`,
      ];

      if (input.learningObjectIds && input.learningObjectIds.length > 0) {
        conditions.push(inArray(learningObjects.id, input.learningObjectIds));
      }

      // Resolve goalIds → conceptIds and filter questions by concept overlap
      let goalConceptFilter: ReturnType<typeof sql> | null = null;
      if (input.goalIds && input.goalIds.length > 0) {
        const items = await db
          .select({ conceptIds: curriculumItems.conceptIds })
          .from(curriculumItems)
          .innerJoin(learningGoals, eq(curriculumItems.goalId, learningGoals.id))
          .where(
            and(
              inArray(curriculumItems.goalId, input.goalIds),
              eq(learningGoals.userId, ctx.userId)
            )
          );

        const conceptIdSet = new Set<string>();
        for (const item of items) {
          for (const cid of item.conceptIds ?? []) conceptIdSet.add(cid);
        }

        const conceptArr = Array.from(conceptIdSet);
        if (conceptArr.length > 0) {
          goalConceptFilter = sql`${questions.conceptIds} && ARRAY[${sql.join(
            conceptArr.map((id) => sql`${id}::uuid`),
            sql`, `
          )}]`;
        }
      }

      if (goalConceptFilter) conditions.push(goalConceptFilter);

      const examQuestions = await db
        .select({
          id: questions.id,
          questionType: questions.questionType,
          questionText: questions.questionText,
          options: questions.options,
          correctAnswer: questions.correctAnswer,
          explanation: questions.explanation,
          difficulty: questions.difficulty,
          conceptIds: questions.conceptIds,
          learningObjectTitle: learningObjects.title,
        })
        .from(questions)
        .innerJoin(learningObjects, eq(questions.learningObjectId, learningObjects.id))
        .where(and(...conditions))
        .orderBy(sql`RANDOM()`)
        .limit(input.questionCount);

      return {
        questions: examQuestions,
        timeLimitMinutes: input.timeLimitMinutes,
        totalQuestions: examQuestions.length,
      };
    }),

  /**
   * Error log: wrong answers grouped by concept — the "mistake tracker"
   * that drives targeted drill generation.
   */
  getErrorLog: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional())
    .query(async ({ ctx }) => {
      const errors = await db
        .select({
          answerId: userAnswers.id,
          answerText: userAnswers.answerText,
          answeredAt: userAnswers.createdAt,
          questionText: questions.questionText,
          questionType: questions.questionType,
          correctAnswer: questions.correctAnswer,
          explanation: questions.explanation,
          difficulty: questions.difficulty,
          conceptIds: questions.conceptIds,
        })
        .from(userAnswers)
        .innerJoin(questions, eq(userAnswers.questionId, questions.id))
        .where(and(eq(userAnswers.userId, ctx.userId), eq(userAnswers.isCorrect, false)))
        .orderBy(desc(userAnswers.createdAt))
        .limit(200);

      const conceptIds = [...new Set(errors.flatMap((e) => e.conceptIds ?? []))];
      let conceptMap = new Map<string, string>();
      if (conceptIds.length > 0) {
        const conceptRows = await db
          .select({ id: concepts.id, name: concepts.displayName })
          .from(concepts)
          .where(inArray(concepts.id, conceptIds));
        conceptMap = new Map(conceptRows.map((c) => [c.id, c.name]));
      }

      const byConceptAcc: Record<string, { name: string; errors: typeof errors; count: number }> =
        {};
      for (const err of errors) {
        const cId = err.conceptIds?.[0] ?? "uncategorized";
        const name = conceptMap.get(cId) ?? "Uncategorized";
        if (!byConceptAcc[cId]) byConceptAcc[cId] = { name, errors: [], count: 0 };
        byConceptAcc[cId].errors.push(err);
        byConceptAcc[cId].count++;
      }

      const byConcept = Object.entries(byConceptAcc)
        .map(([conceptId, data]) => ({ conceptId, ...data }))
        .sort((a, b) => b.count - a.count);

      return { totalErrors: errors.length, byConcept };
    }),

  /**
   * Exam readiness: mastery distribution + readiness score for all studied concepts.
   * Used for exam_prep goals to show how prepared the user is.
   */
  getExamReadiness: protectedProcedure
    .input(z.object({ goalId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [goal] = await db
        .select()
        .from(learningGoals)
        .where(and(eq(learningGoals.id, input.goalId), eq(learningGoals.userId, ctx.userId)))
        .limit(1);

      if (!goal) return null;

      const [items, allStates] = await Promise.all([
        db
          .select({
            id: curriculumItems.id,
            status: curriculumItems.status,
            sequenceOrder: curriculumItems.sequenceOrder,
          })
          .from(curriculumItems)
          .where(eq(curriculumItems.goalId, input.goalId))
          .orderBy(asc(curriculumItems.sequenceOrder)),
        db
          .select({
            conceptId: userConceptState.conceptId,
            masteryLevel: userConceptState.masteryLevel,
            fsrsRetrievability: userConceptState.fsrsRetrievability,
            conceptName: concepts.displayName,
          })
          .from(userConceptState)
          .innerJoin(concepts, eq(userConceptState.conceptId, concepts.id))
          .where(and(eq(userConceptState.userId, ctx.userId), gte(userConceptState.fsrsReps, 1))),
      ]);

      const completedCount = items.filter((i) => i.status === "completed").length;

      const totalStudied = allStates.length;
      const mastered = allStates.filter((s) => (s.masteryLevel ?? 0) >= 3).length;
      const weak = allStates
        .filter((s) => (s.masteryLevel ?? 0) <= 1)
        .map((s) => ({ conceptId: s.conceptId, name: s.conceptName, mastery: s.masteryLevel }));

      const readinessScore = totalStudied > 0 ? Math.round((mastered / totalStudied) * 100) : 0;

      const examDate = goal.examDate;
      const daysUntilExam = examDate
        ? Math.max(0, Math.ceil((examDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : null;

      return {
        readinessScore,
        totalConcepts: totalStudied,
        masteredConcepts: mastered,
        weakConcepts: weak.slice(0, 10),
        curriculumProgress: {
          completed: completedCount,
          total: items.length,
          percent: items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0,
        },
        daysUntilExam,
        examDate: examDate?.toISOString() ?? null,
      };
    }),

  getGraphData: protectedProcedure.query(async ({ ctx }) => {
    const { conceptEdges } = await import("@repo/db");

    const userLOs = await db
      .select({ id: learningObjects.id, title: learningObjects.title, sourceType: learningObjects.sourceType })
      .from(learningObjects)
      .where(eq(learningObjects.userId, ctx.userId));
    const loIdSet = new Set(userLOs.map((r) => r.id));

    const loIdArr = Array.from(loIdSet);

    // Build concept → learning object mapping (scoped to user's content)
    const conceptLOLinks =
      loIdArr.length > 0
        ? await db
            .select({
              conceptId: conceptChunkLinks.conceptId,
              loId: contentChunks.learningObjectId,
            })
            .from(conceptChunkLinks)
            .innerJoin(contentChunks, eq(conceptChunkLinks.chunkId, contentChunks.id))
            .where(inArray(contentChunks.learningObjectId, loIdArr))
        : [];

    const conceptToLOs = new Map<string, string[]>();
    for (const link of conceptLOLinks) {
      const existing = conceptToLOs.get(link.conceptId) ?? [];
      if (!existing.includes(link.loId)) existing.push(link.loId);
      conceptToLOs.set(link.conceptId, existing);
    }

    // Only fetch concepts that belong to the user's learning objects
    const userConceptIds = Array.from(conceptToLOs.keys());
    if (userConceptIds.length === 0) {
      return { nodes: [], edges: [], sources: userLOs.map((lo) => ({ id: lo.id, title: lo.title, sourceType: lo.sourceType })) };
    }

    const nodes = await db
      .select({
        id: concepts.id,
        name: concepts.displayName,
        definition: concepts.definition,
        domain: concepts.domain,
        difficulty: concepts.difficultyLevel,
        mastery: userConceptState.masteryLevel,
        retrievability: userConceptState.fsrsRetrievability,
      })
      .from(concepts)
      .leftJoin(
        userConceptState,
        and(eq(userConceptState.conceptId, concepts.id), eq(userConceptState.userId, ctx.userId))
      )
      .where(inArray(concepts.id, userConceptIds));

    const enrichedNodes = nodes.map((n) => ({
      ...n,
      learningObjectIds: conceptToLOs.get(n.id) ?? [],
      isCrossSource: (conceptToLOs.get(n.id) ?? []).length > 1,
    }));

    const userConceptIdSet = new Set(userConceptIds);
    const allEdges = await db
      .select({
        id: conceptEdges.id,
        source: conceptEdges.sourceId,
        target: conceptEdges.targetId,
        type: conceptEdges.edgeType,
        confidence: conceptEdges.confidence,
      })
      .from(conceptEdges)
      .where(
        and(
          inArray(conceptEdges.sourceId, userConceptIds),
          inArray(conceptEdges.targetId, userConceptIds)
        )
      );
    const edges = allEdges.filter((e) => userConceptIdSet.has(e.source) && userConceptIdSet.has(e.target));

    const sources = userLOs.map((lo) => ({
      id: lo.id,
      title: lo.title,
      sourceType: lo.sourceType,
    }));

    return { nodes: enrichedNodes, edges, sources };
  }),
});

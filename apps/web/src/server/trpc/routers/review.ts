import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import { TRPCError } from "@trpc/server";
import {
  db,
  userConceptState,
  reviewLog,
  questions,
  userAnswers,
  concepts,
} from "@repo/db";
import { eq, and, lte, sql, asc, desc, count } from "drizzle-orm";
import { schedule, getRetrievability, newCard, type Card } from "@repo/fsrs";
import type { FSRSRating } from "@repo/shared";
import {
  DEFAULT_DAILY_REVIEW_LIMIT,
  RETRIEVABILITY_THRESHOLD,
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

function computeMastery(current: number, rating: FSRSRating): number {
  if (rating >= 3 && current < 5) return current + 1;
  if (rating === 1 && current > 0) return current - 1;
  return current;
}

export const reviewRouter = createTRPCRouter({
  getDailyQueue: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).optional() }).optional())
    .query(async ({ ctx }) => {
      const limit = ctx.userId ? (DEFAULT_DAILY_REVIEW_LIMIT) : 20;
      const now = new Date();

      const dueItems = await db
        .select({
          id: userConceptState.id,
          conceptId: userConceptState.conceptId,
          masteryLevel: userConceptState.masteryLevel,
          fsrsRetrievability: userConceptState.fsrsRetrievability,
          nextReviewAt: userConceptState.nextReviewAt,
          conceptName: concepts.displayName,
          conceptDefinition: concepts.definition,
          conceptDifficulty: concepts.difficultyLevel,
        })
        .from(userConceptState)
        .innerJoin(concepts, eq(userConceptState.conceptId, concepts.id))
        .where(
          and(
            eq(userConceptState.userId, ctx.userId),
            lte(userConceptState.nextReviewAt, now),
          ),
        )
        .orderBy(asc(userConceptState.fsrsRetrievability))
        .limit(limit);

      const conceptIds = dueItems.map((d) => d.conceptId);

      let questionsForReview: (typeof questions.$inferSelect)[] = [];
      if (conceptIds.length > 0) {
        questionsForReview = await db
          .select()
          .from(questions)
          .where(
            sql`${questions.conceptIds} && ARRAY[${sql.join(
              conceptIds.map((id) => sql`${id}::uuid`),
              sql`, `,
            )}]`,
          )
          .limit(limit * 2);
      }

      return {
        items: dueItems,
        questions: questionsForReview,
        totalDue: dueItems.length,
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
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [state] = await db
        .select()
        .from(userConceptState)
        .where(
          and(
            eq(userConceptState.userId, ctx.userId),
            eq(userConceptState.conceptId, input.conceptId),
          ),
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

  getStats: protectedProcedure.query(async ({ ctx }) => {
    const [masteryDist] = await db
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
      .where(eq(userConceptState.userId, ctx.userId));

    const recentReviews = await db
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
      .limit(50);

    const streakResult = await db.execute<{ streak_days: number }>(sql`
      WITH daily_reviews AS (
        SELECT DISTINCT DATE(created_at AT TIME ZONE 'UTC') as review_date
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

    const streak = Array.isArray(streakResult) && streakResult.length > 0
      ? Number(streakResult[0].streak_days)
      : 0;

    return {
      mastery: masteryDist ?? { total: 0, m0: 0, m1: 0, m2: 0, m3: 0, m4: 0, m5: 0 },
      recentReviews,
      streak,
    };
  }),

  getGraphData: protectedProcedure.query(async ({ ctx }) => {
    const nodes = await db
      .select({
        id: concepts.id,
        name: concepts.displayName,
        definition: concepts.definition,
        domain: concepts.domain,
        difficulty: concepts.difficultyLevel,
        mastery: userConceptState.masteryLevel,
      })
      .from(concepts)
      .leftJoin(
        userConceptState,
        and(
          eq(userConceptState.conceptId, concepts.id),
          eq(userConceptState.userId, ctx.userId),
        ),
      );

    const { conceptEdges } = await import("@repo/db");
    const edges = await db
      .select({
        id: conceptEdges.id,
        source: conceptEdges.sourceId,
        target: conceptEdges.targetId,
        type: conceptEdges.edgeType,
        confidence: conceptEdges.confidence,
      })
      .from(conceptEdges);

    return { nodes, edges };
  }),
});

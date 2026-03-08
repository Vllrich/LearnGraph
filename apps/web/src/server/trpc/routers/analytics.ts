import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import { db, userConceptState, reviewLog, concepts, users } from "@repo/db";
import { eq, and, sql, gte, count } from "drizzle-orm";

export const analyticsRouter = createTRPCRouter({
  getRetentionCurve: protectedProcedure
    .input(
      z
        .object({
          conceptId: z.string().uuid().optional(),
          days: z.number().min(7).max(365).default(30),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const days = input?.days ?? 30;
      const since = new Date();
      since.setDate(since.getDate() - days);

      const conditions = [eq(reviewLog.userId, ctx.userId), gte(reviewLog.createdAt, since)];
      if (input?.conceptId) {
        conditions.push(eq(reviewLog.conceptId, input.conceptId));
      }

      const dailyReviews = await db.execute<{
        review_date: string;
        total: number;
        correct: number;
        accuracy: number;
      }>(sql`
        SELECT
          DATE(${reviewLog.createdAt} AT TIME ZONE COALESCE(
            (SELECT timezone FROM users WHERE id = ${ctx.userId}), 'UTC'
          )) as review_date,
          COUNT(*)::int as total,
          COUNT(CASE WHEN ${reviewLog.rating} >= 3 THEN 1 END)::int as correct,
          ROUND(COUNT(CASE WHEN ${reviewLog.rating} >= 3 THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1)::float as accuracy
        FROM ${reviewLog}
        WHERE ${reviewLog.userId} = ${ctx.userId}
          AND ${reviewLog.createdAt} >= ${since}
          ${input?.conceptId ? sql`AND ${reviewLog.conceptId} = ${input.conceptId}` : sql``}
        GROUP BY review_date
        ORDER BY review_date ASC
      `);

      const avgRetrievability = await db
        .select({
          avg: sql<number>`AVG(${userConceptState.fsrsRetrievability})::float`,
        })
        .from(userConceptState)
        .where(and(eq(userConceptState.userId, ctx.userId), sql`${userConceptState.fsrsReps} > 0`));

      return {
        dailyAccuracy: Array.isArray(dailyReviews) ? dailyReviews : [],
        averageRetrievability: avgRetrievability[0]?.avg ?? 0,
      };
    }),

  getStudyEfficiency: protectedProcedure.query(async ({ ctx }) => {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const weeklyData = await db.execute<{
      week: string;
      reviews: number;
      mastery_gained: number;
      avg_time_ms: number;
    }>(sql`
      SELECT
        DATE_TRUNC('week', ${reviewLog.createdAt})::date as week,
        COUNT(*)::int as reviews,
        COUNT(CASE WHEN ${reviewLog.rating} >= 3 THEN 1 END)::int as mastery_gained,
        COALESCE(AVG(${reviewLog.responseTimeMs}), 0)::int as avg_time_ms
      FROM ${reviewLog}
      WHERE ${reviewLog.userId} = ${ctx.userId}
        AND ${reviewLog.createdAt} >= ${last30Days}
      GROUP BY week
      ORDER BY week ASC
    `);

    const currentWeek = Array.isArray(weeklyData) ? weeklyData[weeklyData.length - 1] : null;
    const prevWeek =
      Array.isArray(weeklyData) && weeklyData.length >= 2
        ? weeklyData[weeklyData.length - 2]
        : null;

    const reviewsTrend = prevWeek
      ? Math.round(
          ((Number(currentWeek?.reviews ?? 0) - Number(prevWeek.reviews)) /
            Math.max(Number(prevWeek.reviews), 1)) *
            100
        )
      : 0;

    return {
      weeklyData: Array.isArray(weeklyData) ? weeklyData : [],
      reviewsTrend,
    };
  }),

  getPredictedReadiness: protectedProcedure
    .input(z.object({ goalId: z.string().uuid().optional(), daysFromNow: z.number().default(7) }))
    .query(async ({ ctx, input }) => {
      const states = await db
        .select({
          conceptId: userConceptState.conceptId,
          mastery: userConceptState.masteryLevel,
          retrievability: userConceptState.fsrsRetrievability,
          stability: userConceptState.fsrsStability,
          nextReview: userConceptState.nextReviewAt,
          conceptName: concepts.displayName,
        })
        .from(userConceptState)
        .innerJoin(concepts, eq(userConceptState.conceptId, concepts.id))
        .where(and(eq(userConceptState.userId, ctx.userId), sql`${userConceptState.fsrsReps} > 0`));

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + (input?.daysFromNow ?? 7));
      const now = Date.now();

      const predictions = states.map((s) => {
        const stability = s.stability ?? 1;
        const elapsedDays = (futureDate.getTime() - now) / 86400000;
        const predictedRetrieval = Math.exp(
          (-elapsedDays / Math.max(stability, 0.01)) * Math.log(2)
        );
        return {
          conceptId: s.conceptId,
          conceptName: s.conceptName,
          currentRetrievability: s.retrievability ?? 0,
          predictedRetrievability: Math.round(predictedRetrieval * 100) / 100,
          mastery: s.mastery ?? 0,
          atRisk: predictedRetrieval < 0.5,
        };
      });

      const totalConcepts = predictions.length;
      const likelyRecalled = predictions.filter((p) => p.predictedRetrievability >= 0.7).length;
      const atRisk = predictions.filter((p) => p.atRisk);
      const readinessScore =
        totalConcepts > 0 ? Math.round((likelyRecalled / totalConcepts) * 100) : 0;

      return {
        readinessScore,
        totalConcepts,
        likelyRecalled,
        atRiskConcepts: atRisk
          .sort((a, b) => a.predictedRetrievability - b.predictedRetrievability)
          .slice(0, 10),
        daysFromNow: input?.daysFromNow ?? 7,
      };
    }),

  getBestStudyTimes: protectedProcedure.query(async ({ ctx }) => {
    const hourlyPerformance = await db.execute<{
      hour: number;
      total: number;
      correct: number;
      accuracy: number;
    }>(sql`
      SELECT
        EXTRACT(HOUR FROM ${reviewLog.createdAt} AT TIME ZONE COALESCE(
          (SELECT timezone FROM users WHERE id = ${ctx.userId}), 'UTC'
        ))::int as hour,
        COUNT(*)::int as total,
        COUNT(CASE WHEN ${reviewLog.rating} >= 3 THEN 1 END)::int as correct,
        ROUND(COUNT(CASE WHEN ${reviewLog.rating} >= 3 THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1)::float as accuracy
      FROM ${reviewLog}
      WHERE ${reviewLog.userId} = ${ctx.userId}
      GROUP BY hour
      HAVING COUNT(*) >= 3
      ORDER BY accuracy DESC
    `);

    const data = Array.isArray(hourlyPerformance) ? hourlyPerformance : [];
    const bestHour = data.length > 0 ? data[0] : null;

    return {
      hourlyPerformance: data,
      bestHour: bestHour ? { hour: bestHour.hour, accuracy: bestHour.accuracy } : null,
    };
  }),

  getComparativeStats: protectedProcedure.query(async ({ ctx }) => {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const [thisWeekStats] = await db
      .select({ total: count() })
      .from(reviewLog)
      .where(and(eq(reviewLog.userId, ctx.userId), gte(reviewLog.createdAt, lastWeek)));

    const [lastWeekStats] = await db
      .select({ total: count() })
      .from(reviewLog)
      .where(
        and(
          eq(reviewLog.userId, ctx.userId),
          gte(reviewLog.createdAt, twoWeeksAgo),
          sql`${reviewLog.createdAt} < ${lastWeek}`
        )
      );

    const thisWeekReviews = Number(thisWeekStats?.total ?? 0);
    const lastWeekReviews = Number(lastWeekStats?.total ?? 0);
    const reviewChange =
      lastWeekReviews > 0
        ? Math.round(((thisWeekReviews - lastWeekReviews) / lastWeekReviews) * 100)
        : thisWeekReviews > 0
          ? 100
          : 0;

    const [masteredThisWeek] = await db
      .select({ cnt: count() })
      .from(userConceptState)
      .where(
        and(
          eq(userConceptState.userId, ctx.userId),
          eq(userConceptState.masteryLevel, 5),
          gte(userConceptState.updatedAt, lastWeek)
        )
      );

    return {
      thisWeekReviews,
      lastWeekReviews,
      reviewChange,
      conceptsMasteredThisWeek: Number(masteredThisWeek?.cnt ?? 0),
    };
  }),
});

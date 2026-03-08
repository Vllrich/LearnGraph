import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import {
  db,
  userStreaks,
  userAchievements,
  userConceptState,
  reviewLog,
  users,
  userWeeklySnapshots,
} from "@repo/db";
import { eq, and, sql, gte, count, desc } from "drizzle-orm";
import { ACHIEVEMENT_DEFINITIONS, XP_VALUES } from "@repo/shared";
import type { AchievementKey } from "@repo/shared";

function getWeekStart(d: Date): string {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  return monday.toISOString().split("T")[0];
}

function getTodayStr(tz: string): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: tz });
}

async function ensureStreak(userId: string): Promise<typeof userStreaks.$inferSelect> {
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

async function grantAchievement(userId: string, key: AchievementKey): Promise<boolean> {
  const def = ACHIEVEMENT_DEFINITIONS.find((a) => a.key === key);
  if (!def) return false;

  try {
    await db.insert(userAchievements).values({
      userId,
      achievementKey: key,
    });

    await db
      .update(userStreaks)
      .set({
        totalXp: sql`COALESCE(${userStreaks.totalXp}, 0) + ${def.xp}`,
        updatedAt: new Date(),
      })
      .where(eq(userStreaks.userId, userId));

    return true;
  } catch {
    return false;
  }
}

export const gamificationRouter = createTRPCRouter({
  getStreakAndXp: protectedProcedure.query(async ({ ctx }) => {
    const streak = await ensureStreak(ctx.userId);
    const [userRow] = await db
      .select({ timezone: users.timezone })
      .from(users)
      .where(eq(users.id, ctx.userId))
      .limit(1);
    const tz = userRow?.timezone ?? "UTC";
    const today = getTodayStr(tz);
    const weekStart = getWeekStart(new Date());

    const needsWeekReset = !streak.weekStart || streak.weekStart < weekStart;

    if (needsWeekReset) {
      await db
        .update(userStreaks)
        .set({ weekStart, weeklyReviewsDone: 0, freezesUsed: 0, freezeWeekStart: weekStart })
        .where(eq(userStreaks.id, streak.id));
      streak.weeklyReviewsDone = 0;
      streak.freezesUsed = 0;
    }

    return {
      currentStreak: streak.currentStreak ?? 0,
      longestStreak: streak.longestStreak ?? 0,
      totalXp: streak.totalXp ?? 0,
      weeklyReviewGoal: streak.weeklyReviewGoal ?? 50,
      weeklyReviewsDone: streak.weeklyReviewsDone ?? 0,
      freezesAvailable: 1 - (streak.freezesUsed ?? 0),
      lastActivityDate: streak.lastActivityDate,
      today,
    };
  }),

  recordActivity: protectedProcedure
    .input(
      z.object({
        type: z.enum(["review", "upload", "explain_back_success", "explain_back_attempt"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const streak = await ensureStreak(ctx.userId);
      const [userRow] = await db
        .select({ timezone: users.timezone })
        .from(users)
        .where(eq(users.id, ctx.userId))
        .limit(1);
      const tz = userRow?.timezone ?? "UTC";
      const today = getTodayStr(tz);

      const xpGain = XP_VALUES[input.type] ?? 0;
      const isNewDay = streak.lastActivityDate !== today;

      const updates: Record<string, unknown> = {
        totalXp: sql`COALESCE(${userStreaks.totalXp}, 0) + ${xpGain}`,
        updatedAt: new Date(),
      };

      if (input.type === "review") {
        updates.weeklyReviewsDone = sql`COALESCE(${userStreaks.weeklyReviewsDone}, 0) + 1`;
      }

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
          const canFreeze = (streak.freezesUsed ?? 0) < 1;
          const daysBetween = streak.lastActivityDate
            ? Math.floor(
                (new Date(today).getTime() - new Date(streak.lastActivityDate).getTime()) / 86400000
              )
            : 999;
          if (canFreeze && daysBetween === 2) {
            updates.freezesUsed = (streak.freezesUsed ?? 0) + 1;
            updates.currentStreak = (streak.currentStreak ?? 0) + 1;
            updates.longestStreak = sql`GREATEST(COALESCE(${userStreaks.longestStreak}, 0), ${(streak.currentStreak ?? 0) + 1})`;
          } else {
            updates.currentStreak = 1;
          }
        }

        updates.lastActivityDate = today;
      }

      await db.update(userStreaks).set(updates).where(eq(userStreaks.id, streak.id));

      const newAchievements: string[] = [];
      const updatedStreak = (updates.currentStreak as number) ?? streak.currentStreak ?? 0;

      if (updatedStreak >= 7 && (await grantAchievement(ctx.userId, "streak_7")))
        newAchievements.push("streak_7");
      if (updatedStreak >= 30 && (await grantAchievement(ctx.userId, "streak_30")))
        newAchievements.push("streak_30");
      if (updatedStreak >= 100 && (await grantAchievement(ctx.userId, "streak_100")))
        newAchievements.push("streak_100");
      if (input.type === "review" && (await grantAchievement(ctx.userId, "first_review")))
        newAchievements.push("first_review");
      if (input.type === "explain_back_success") {
        if (await grantAchievement(ctx.userId, "explain_back_first"))
          newAchievements.push("explain_back_first");
      }

      return { xpGain, newAchievements };
    }),

  getAchievements: protectedProcedure.query(async ({ ctx }) => {
    const unlocked = await db
      .select()
      .from(userAchievements)
      .where(eq(userAchievements.userId, ctx.userId))
      .orderBy(desc(userAchievements.unlockedAt));

    const unlockedKeys = new Set(unlocked.map((a) => a.achievementKey));

    return ACHIEVEMENT_DEFINITIONS.map((def) => ({
      ...def,
      unlocked: unlockedKeys.has(def.key),
      unlockedAt: unlocked.find((a) => a.achievementKey === def.key)?.unlockedAt ?? null,
    }));
  }),

  getWeeklyJournal: protectedProcedure
    .input(z.object({ weeksBack: z.number().min(0).max(12).default(0) }).optional())
    .query(async ({ ctx, input }) => {
      const weeksBack = input?.weeksBack ?? 0;
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - weeksBack * 7);
      const weekStart = getWeekStart(targetDate);

      const [snapshot] = await db
        .select()
        .from(userWeeklySnapshots)
        .where(
          and(
            eq(userWeeklySnapshots.userId, ctx.userId),
            eq(userWeeklySnapshots.weekStart, weekStart)
          )
        )
        .limit(1);

      if (snapshot) return snapshot;

      const weekStartDate = new Date(weekStart);
      const weekEndDate = new Date(weekStart);
      weekEndDate.setDate(weekEndDate.getDate() + 7);

      const [reviewStats] = await db
        .select({
          total: count(),
          goodOrBetter: count(sql`CASE WHEN ${reviewLog.rating} >= 3 THEN 1 END`),
        })
        .from(reviewLog)
        .where(
          and(
            eq(reviewLog.userId, ctx.userId),
            gte(reviewLog.createdAt, weekStartDate),
            sql`${reviewLog.createdAt} < ${weekEndDate}`
          )
        );

      const masteredThisWeek = await db
        .select({ cnt: count() })
        .from(userConceptState)
        .where(
          and(
            eq(userConceptState.userId, ctx.userId),
            eq(userConceptState.masteryLevel, 5),
            gte(userConceptState.updatedAt, weekStartDate),
            sql`${userConceptState.updatedAt} < ${weekEndDate}`
          )
        );

      const struggled = await db
        .select({ cnt: count() })
        .from(reviewLog)
        .where(
          and(
            eq(reviewLog.userId, ctx.userId),
            eq(reviewLog.rating, 1),
            gte(reviewLog.createdAt, weekStartDate),
            sql`${reviewLog.createdAt} < ${weekEndDate}`
          )
        );

      const totalReviews = Number(reviewStats?.total ?? 0);
      const goodReviews = Number(reviewStats?.goodOrBetter ?? 0);
      const accuracy = totalReviews > 0 ? goodReviews / totalReviews : 0;

      return {
        weekStart,
        conceptsMastered: Number(masteredThisWeek[0]?.cnt ?? 0),
        conceptsStruggled: Number(struggled[0]?.cnt ?? 0),
        reviewsCompleted: totalReviews,
        averageAccuracy: Math.round(accuracy * 100),
        totalStudyTimeMs: 0,
        streakDays: 0,
        xpEarned: 0,
      };
    }),

  updateWeeklyGoal: protectedProcedure
    .input(z.object({ goal: z.number().min(5).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const streak = await ensureStreak(ctx.userId);
      await db
        .update(userStreaks)
        .set({ weeklyReviewGoal: input.goal, updatedAt: new Date() })
        .where(eq(userStreaks.id, streak.id));
      return { success: true };
    }),
});

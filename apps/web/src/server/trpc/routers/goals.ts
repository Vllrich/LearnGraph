import { z } from "zod";
import crypto from "crypto";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../init";
import { db, learningGoals, curriculumItems, sharedCurriculums } from "@repo/db";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

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
});

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import { learningObjects, contentChunks, concepts, conceptChunkLinks, questions } from "@repo/db";
import { eq, desc, and, sql, ne, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const libraryRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const items = await ctx.db
        .select({
          id: learningObjects.id,
          title: learningObjects.title,
          sourceType: learningObjects.sourceType,
          sourceUrl: learningObjects.sourceUrl,
          status: learningObjects.status,
          summaryTldr: learningObjects.summaryTldr,
          metadata: learningObjects.metadata,
          createdAt: learningObjects.createdAt,
          updatedAt: learningObjects.updatedAt,
        })
        .from(learningObjects)
        .where(eq(learningObjects.userId, ctx.userId))
        .orderBy(desc(learningObjects.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countResult] = await ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(learningObjects)
        .where(eq(learningObjects.userId, ctx.userId));

      return { items, total: Number(countResult.count) };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [item] = await ctx.db
        .select()
        .from(learningObjects)
        .where(and(eq(learningObjects.id, input.id), eq(learningObjects.userId, ctx.userId)))
        .limit(1);

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Content not found" });
      }

      const chunks = await ctx.db
        .select({
          id: contentChunks.id,
          chunkIndex: contentChunks.chunkIndex,
          content: contentChunks.content,
          sectionTitle: contentChunks.sectionTitle,
          pageNumber: contentChunks.pageNumber,
          tokenCount: contentChunks.tokenCount,
        })
        .from(contentChunks)
        .where(eq(contentChunks.learningObjectId, input.id))
        .orderBy(contentChunks.chunkIndex);

      const conceptRows = await ctx.db
        .select({
          id: concepts.id,
          displayName: concepts.displayName,
          definition: concepts.definition,
          difficultyLevel: concepts.difficultyLevel,
          bloomLevel: concepts.bloomLevel,
        })
        .from(concepts)
        .innerJoin(conceptChunkLinks, eq(concepts.id, conceptChunkLinks.conceptId))
        .innerJoin(contentChunks, eq(conceptChunkLinks.chunkId, contentChunks.id))
        .where(eq(contentChunks.learningObjectId, input.id))
        .groupBy(
          concepts.id,
          concepts.displayName,
          concepts.definition,
          concepts.difficultyLevel,
          concepts.bloomLevel
        );

      return { ...item, chunks, concepts: conceptRows };
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        sourceType: z.enum(["pdf", "youtube", "docx", "pptx", "audio", "url", "image"]),
        sourceUrl: z.string().url().optional(),
        filePath: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [item] = await ctx.db
        .insert(learningObjects)
        .values({
          userId: ctx.userId,
          title: input.title,
          sourceType: input.sourceType,
          sourceUrl: input.sourceUrl,
          filePath: input.filePath,
          status: "processing",
        })
        .returning();

      return item;
    }),

  getQuestions: protectedProcedure
    .input(z.object({ learningObjectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [owned] = await ctx.db
        .select({ id: learningObjects.id })
        .from(learningObjects)
        .where(
          and(
            eq(learningObjects.id, input.learningObjectId),
            eq(learningObjects.userId, ctx.userId)
          )
        )
        .limit(1);

      if (!owned) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return ctx.db
        .select({
          id: questions.id,
          questionType: questions.questionType,
          questionText: questions.questionText,
          options: questions.options,
          correctAnswer: questions.correctAnswer,
          explanation: questions.explanation,
          difficulty: questions.difficulty,
          conceptIds: questions.conceptIds,
        })
        .from(questions)
        .where(eq(questions.learningObjectId, input.learningObjectId))
        .orderBy(questions.difficulty);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [item] = await ctx.db
        .select({ id: learningObjects.id })
        .from(learningObjects)
        .where(and(eq(learningObjects.id, input.id), eq(learningObjects.userId, ctx.userId)))
        .limit(1);

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Content not found" });
      }

      await ctx.db.delete(learningObjects).where(eq(learningObjects.id, input.id));

      return { success: true };
    }),

  relatedContent: protectedProcedure
    .input(z.object({ learningObjectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Find concepts in this learning object
      const loConcepts = await ctx.db
        .select({ conceptId: conceptChunkLinks.conceptId })
        .from(conceptChunkLinks)
        .innerJoin(contentChunks, eq(conceptChunkLinks.chunkId, contentChunks.id))
        .where(eq(contentChunks.learningObjectId, input.learningObjectId));

      const conceptIds = [...new Set(loConcepts.map((c) => c.conceptId))];
      if (conceptIds.length === 0) return [];

      // Find other learning objects that share these concepts
      const relatedRows = await ctx.db
        .select({
          loId: contentChunks.learningObjectId,
          conceptId: conceptChunkLinks.conceptId,
        })
        .from(conceptChunkLinks)
        .innerJoin(contentChunks, eq(conceptChunkLinks.chunkId, contentChunks.id))
        .innerJoin(learningObjects, eq(contentChunks.learningObjectId, learningObjects.id))
        .where(
          and(
            inArray(conceptChunkLinks.conceptId, conceptIds),
            ne(contentChunks.learningObjectId, input.learningObjectId),
            eq(learningObjects.userId, ctx.userId)
          )
        );

      // Aggregate: count shared concepts per related LO
      const loSharedCounts = new Map<string, Set<string>>();
      for (const row of relatedRows) {
        const existing = loSharedCounts.get(row.loId) ?? new Set();
        existing.add(row.conceptId);
        loSharedCounts.set(row.loId, existing);
      }

      const relatedLoIds = [...loSharedCounts.entries()]
        .sort((a, b) => b[1].size - a[1].size)
        .slice(0, 10)
        .map(([id]) => id);

      if (relatedLoIds.length === 0) return [];

      const relatedLOs = await ctx.db
        .select({
          id: learningObjects.id,
          title: learningObjects.title,
          sourceType: learningObjects.sourceType,
          summaryTldr: learningObjects.summaryTldr,
        })
        .from(learningObjects)
        .where(inArray(learningObjects.id, relatedLoIds));

      return relatedLOs.map((lo) => ({
        ...lo,
        sharedConceptCount: loSharedCounts.get(lo.id)?.size ?? 0,
      }));
    }),

  getConnectionCount: protectedProcedure
    .input(z.object({ learningObjectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Count how many concepts from this LO also appear in other LOs
      const loConcepts = await ctx.db
        .select({ conceptId: conceptChunkLinks.conceptId })
        .from(conceptChunkLinks)
        .innerJoin(contentChunks, eq(conceptChunkLinks.chunkId, contentChunks.id))
        .where(eq(contentChunks.learningObjectId, input.learningObjectId));

      const conceptIds = [...new Set(loConcepts.map((c) => c.conceptId))];
      if (conceptIds.length === 0) return { connections: 0 };

      const crossLinks = await ctx.db
        .select({ loId: contentChunks.learningObjectId })
        .from(conceptChunkLinks)
        .innerJoin(contentChunks, eq(conceptChunkLinks.chunkId, contentChunks.id))
        .innerJoin(learningObjects, eq(contentChunks.learningObjectId, learningObjects.id))
        .where(
          and(
            inArray(conceptChunkLinks.conceptId, conceptIds),
            ne(contentChunks.learningObjectId, input.learningObjectId),
            eq(learningObjects.userId, ctx.userId)
          )
        );

      const uniqueLOs = new Set(crossLinks.map((r) => r.loId));
      return { connections: uniqueLOs.size };
    }),

  rateQuestion: protectedProcedure
    .input(
      z.object({
        questionId: z.string().uuid(),
        feedback: z.enum(["up", "down"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const column = input.feedback === "up" ? questions.thumbsUp : questions.thumbsDown;

      await ctx.db
        .update(questions)
        .set({
          [input.feedback === "up" ? "thumbsUp" : "thumbsDown"]: sql`COALESCE(${column}, 0) + 1`,
        })
        .where(eq(questions.id, input.questionId));

      // Auto-exclude questions with >3 thumbs down and negative net score
      const [q] = await ctx.db
        .select({
          thumbsUp: questions.thumbsUp,
          thumbsDown: questions.thumbsDown,
        })
        .from(questions)
        .where(eq(questions.id, input.questionId))
        .limit(1);

      if (q && (q.thumbsDown ?? 0) >= 3 && (q.thumbsDown ?? 0) > (q.thumbsUp ?? 0) * 2) {
        await ctx.db
          .update(questions)
          .set({ isExcluded: true, qualityScore: 0 })
          .where(eq(questions.id, input.questionId));
      }

      return { success: true };
    }),
});

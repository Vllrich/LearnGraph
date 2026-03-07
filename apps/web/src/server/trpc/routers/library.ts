import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import {
  learningObjects,
  contentChunks,
  concepts,
  conceptChunkLinks,
} from "@repo/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const libraryRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      }),
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
        .where(
          and(
            eq(learningObjects.id, input.id),
            eq(learningObjects.userId, ctx.userId),
          ),
        )
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
        .innerJoin(
          conceptChunkLinks,
          eq(concepts.id, conceptChunkLinks.conceptId),
        )
        .innerJoin(
          contentChunks,
          eq(conceptChunkLinks.chunkId, contentChunks.id),
        )
        .where(eq(contentChunks.learningObjectId, input.id))
        .groupBy(
          concepts.id,
          concepts.displayName,
          concepts.definition,
          concepts.difficultyLevel,
          concepts.bloomLevel,
        );

      return { ...item, chunks, concepts: conceptRows };
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        sourceType: z.enum(["pdf", "youtube"]),
        sourceUrl: z.string().url().optional(),
        filePath: z.string().optional(),
      }),
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

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [item] = await ctx.db
        .select({ id: learningObjects.id })
        .from(learningObjects)
        .where(
          and(
            eq(learningObjects.id, input.id),
            eq(learningObjects.userId, ctx.userId),
          ),
        )
        .limit(1);

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Content not found" });
      }

      await ctx.db
        .delete(learningObjects)
        .where(eq(learningObjects.id, input.id));

      return { success: true };
    }),
});

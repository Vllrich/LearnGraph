import { createTRPCRouter, protectedProcedure } from "../init";
import { learningObjects, questions, userConceptState, mentorConversations } from "@repo/db";
import { eq, sql } from "drizzle-orm";

export const exportRouter = createTRPCRouter({
  getExportStats: protectedProcedure.query(async ({ ctx }) => {
    const [loCount, questionCount, conceptCount, convCount] = await Promise.all([
      ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(learningObjects)
        .where(eq(learningObjects.userId, ctx.userId))
        .then((rows) => rows[0]),
      ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(questions)
        .innerJoin(learningObjects, eq(questions.learningObjectId, learningObjects.id))
        .where(eq(learningObjects.userId, ctx.userId))
        .then((rows) => rows[0]),
      ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(userConceptState)
        .where(eq(userConceptState.userId, ctx.userId))
        .then((rows) => rows[0]),
      ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(mentorConversations)
        .where(eq(mentorConversations.userId, ctx.userId))
        .then((rows) => rows[0]),
    ]);

    return {
      learningObjects: Number(loCount.count),
      flashcards: Number(questionCount.count),
      concepts: Number(conceptCount.count),
      conversations: Number(convCount.count),
    };
  }),
});

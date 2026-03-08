import { generateObject } from "ai";
import { z } from "zod";
import { fallbackModel } from "../models";
import { retrieveChunks } from "../rag";
import { db, questions, concepts, conceptChunkLinks, contentChunks } from "@repo/db";
import { eq, inArray } from "drizzle-orm";

const questionSchema = z.object({
  questions: z.array(
    z.object({
      questionText: z.string(),
      type: z.enum(["mcq", "short_answer", "fill_blank"]),
      options: z.array(z.string()).optional(),
      correctAnswer: z.string(),
      explanation: z.string(),
      difficulty: z.number().min(1).max(5),
    })
  ),
});

/**
 * Generate quiz questions for a set of concepts from a learning object.
 * Uses RAG to ground questions in source material.
 */
export async function generateQuizForConcepts(
  learningObjectId: string,
  conceptIds: string[],
  questionsPerConcept = 3
): Promise<number> {
  if (conceptIds.length === 0) return 0;

  const conceptRows = await db
    .select({ id: concepts.id, displayName: concepts.displayName, definition: concepts.definition })
    .from(concepts)
    .where(inArray(concepts.id, conceptIds));

  let totalInserted = 0;

  for (const concept of conceptRows) {
    const chunks = await retrieveChunks(concept.displayName ?? "", {
      learningObjectId,
      topK: 5,
    });

    if (chunks.length === 0) continue;

    const context = chunks
      .map((c, i) => `[Chunk ${i + 1}${c.pageNumber ? `, p.${c.pageNumber}` : ""}]\n${c.content}`)
      .join("\n\n---\n\n");

    try {
      const { object } = await generateObject({
        model: fallbackModel,
        schema: questionSchema,
        prompt: `Generate ${questionsPerConcept} quiz questions about the concept "${concept.displayName}" (${concept.definition ?? "no definition"}).

Ground every question in the following source material. Do NOT make up facts.

--- SOURCE MATERIAL ---
${context}
--- END ---

Requirements:
- Mix question types: MCQ (4 options, exactly 1 correct), short_answer, fill_blank
- MCQ options should be plausible — no obviously wrong answers
- Difficulty should vary from 2 to 4
- Explanations should reference the source material
- Questions should test understanding, not just recall`,
        temperature: 0.5,
      });

      const chunkIds = chunks.map((c) => c.id);

      for (const q of object.questions) {
        await db.insert(questions).values({
          learningObjectId,
          questionType: q.type,
          questionText: q.questionText,
          options: q.options ?? null,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          difficulty: q.difficulty,
          conceptIds: [concept.id],
          groundingChunks: chunkIds,
        });
        totalInserted++;
      }
    } catch {
      // Skip this concept if LLM fails
      continue;
    }
  }

  return totalInserted;
}

/**
 * Generate quiz questions for all concepts linked to a learning object.
 * Called after ingestion completes.
 */
export async function generateQuizForLearningObject(learningObjectId: string): Promise<number> {
  const links = await db
    .selectDistinct({ conceptId: conceptChunkLinks.conceptId })
    .from(conceptChunkLinks)
    .innerJoin(contentChunks, eq(conceptChunkLinks.chunkId, contentChunks.id))
    .where(eq(contentChunks.learningObjectId, learningObjectId));

  const ids = links.map((l) => l.conceptId);
  return generateQuizForConcepts(learningObjectId, ids, 3);
}

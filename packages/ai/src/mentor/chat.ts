import { streamText, tool } from "ai";
import { z } from "zod";
import { primaryModel } from "../models";
import { retrieveChunks } from "../rag";
import { db, mentorConversations, userConceptState, concepts, questions } from "@repo/db";
import { eq, and, sql } from "drizzle-orm";
import { MASTERY_LABELS } from "@repo/shared";
import type { MasteryLevel } from "@repo/shared";

const GROUNDING_THRESHOLD = 0.25;

export type MentorMessage = {
  role: "user" | "assistant";
  content: string;
  citations?: { chunkId: string; content: string; pageNumber: number | null }[];
};

const SYSTEM_PROMPT = `You are an AI learning mentor for LearnGraph. Your teaching method follows this loop:

ASSESS → TEACH → PRACTICE → VERIFY → CONNECT

Guidelines:
- Ground EVERY factual claim in the retrieved content chunks. Cite them as [Source: page X] when referencing.
- Use Socratic questioning — ask the student to think before giving answers.
- Break complex ideas into digestible parts.
- If you don't have enough source material to answer, say: "I don't have enough information about this in your materials."
- Be warm, encouraging, and concise. Use analogies when helpful.
- Format responses with markdown: use **bold** for key terms, bullet lists for steps, and code blocks when relevant.
- Adapt difficulty to the student's mastery level. Use check_knowledge_state to see how well they know a concept.
- You can generate inline quiz questions with generate_quiz to test understanding.`;

export type MentorStreamOpts = {
  conversationId: string | null;
  userId: string;
  learningObjectId: string | null;
  message: string;
  history: MentorMessage[];
};

/**
 * Stream a mentor response with RAG-grounded context and pedagogical tools.
 */
export async function streamMentorResponse(opts: MentorStreamOpts) {
  const { userId, learningObjectId, message, history } = opts;

  const chunks = await retrieveChunks(message, {
    learningObjectId: learningObjectId ?? undefined,
    userId,
    topK: 5,
  });

  const maxScore = chunks.length > 0 ? Math.max(...chunks.map((c) => c.score)) : 0;
  const hasGrounding = maxScore >= GROUNDING_THRESHOLD;

  const contextBlock = hasGrounding
    ? chunks
        .map(
          (c, i) =>
            `[Chunk ${i + 1}${c.pageNumber ? `, p.${c.pageNumber}` : ""}, score=${c.score.toFixed(3)}]\n${c.content}`
        )
        .join("\n\n---\n\n")
    : "No sufficiently relevant content found. Tell the user you don't have enough information in their materials to answer this.";

  const messages = [
    ...history.slice(-20).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: message },
  ];

  const result = streamText({
    model: primaryModel,
    system: `${SYSTEM_PROMPT}\n\n--- RETRIEVED CONTEXT ---\n${contextBlock}\n--- END CONTEXT ---`,
    messages,
    tools: {
      retrieve_content: tool({
        description: "Search for more relevant content from the user's learning materials",
        parameters: z.object({
          query: z.string().max(500).describe("Search query to find relevant content"),
        }),
        execute: async ({ query }) => {
          const moreChunks = await retrieveChunks(query, {
            learningObjectId: learningObjectId ?? undefined,
            userId,
            topK: 3,
          });
          return moreChunks.map((c) => ({
            content: c.content.slice(0, 500),
            page: c.pageNumber,
            score: c.score,
          }));
        },
      }),
      check_knowledge_state: tool({
        description: "Check the student's mastery level for a specific concept",
        parameters: z.object({
          conceptName: z.string().max(200).describe("Name of the concept to check"),
        }),
        execute: async ({ conceptName }) => {
          const [concept] = await db
            .select({ id: concepts.id, displayName: concepts.displayName })
            .from(concepts)
            .where(sql`LOWER(${concepts.canonicalName}) = LOWER(${conceptName.trim()})`)
            .limit(1);

          if (!concept)
            return {
              found: false,
              message: `Concept "${conceptName}" not found in the knowledge graph.`,
            };

          const [state] = await db
            .select({
              masteryLevel: userConceptState.masteryLevel,
              fsrsRetrievability: userConceptState.fsrsRetrievability,
              lastReviewAt: userConceptState.lastReviewAt,
            })
            .from(userConceptState)
            .where(
              and(eq(userConceptState.userId, userId), eq(userConceptState.conceptId, concept.id))
            )
            .limit(1);

          const level = (state?.masteryLevel ?? 0) as MasteryLevel;
          return {
            found: true,
            conceptName: concept.displayName,
            masteryLevel: level,
            masteryLabel: MASTERY_LABELS[level],
            retrievability: state?.fsrsRetrievability ?? 0,
            lastReviewed: state?.lastReviewAt?.toISOString() ?? null,
          };
        },
      }),
      generate_quiz: tool({
        description:
          "Generate an inline quiz question for a concept to test the student's understanding",
        parameters: z.object({
          conceptName: z.string().max(200).describe("Concept to quiz on"),
          difficulty: z.number().min(1).max(5).optional().describe("Difficulty level 1-5"),
        }),
        execute: async ({ conceptName, difficulty }) => {
          const [concept] = await db
            .select({ id: concepts.id })
            .from(concepts)
            .where(sql`LOWER(${concepts.canonicalName}) = LOWER(${conceptName.trim()})`)
            .limit(1);

          if (!concept) return { error: `Concept "${conceptName}" not found.` };

          const questionRows = await db
            .select()
            .from(questions)
            .where(
              sql`${questions.conceptIds} && ARRAY[${concept.id}::uuid]${
                difficulty ? sql` AND ${questions.difficulty} = ${difficulty}` : sql``
              }`
            )
            .limit(3);

          if (questionRows.length === 0) {
            return { error: "No pre-generated questions available for this concept." };
          }

          const q = questionRows[Math.floor(Math.random() * questionRows.length)];
          return {
            questionId: q.id,
            type: q.questionType,
            question: q.questionText,
            options: q.options,
            difficulty: q.difficulty,
          };
        },
      }),
    },
    maxSteps: 5,
    temperature: 0.4,
  });

  return { result, chunks };
}

/**
 * Save or update a conversation in the database.
 */
export async function saveConversation(opts: {
  conversationId: string | null;
  userId: string;
  learningObjectId: string | null;
  messages: MentorMessage[];
}): Promise<string> {
  const { conversationId, userId, learningObjectId, messages } = opts;

  if (conversationId) {
    await db
      .update(mentorConversations)
      .set({
        messages: JSON.stringify(messages),
        updatedAt: new Date(),
      })
      .where(
        and(eq(mentorConversations.id, conversationId), eq(mentorConversations.userId, userId))
      );
    return conversationId;
  }

  const title = messages[0]?.content.slice(0, 80) || "New conversation";

  const [inserted] = await db
    .insert(mentorConversations)
    .values({
      userId,
      learningObjectId,
      title,
      messages: JSON.stringify(messages),
    })
    .returning({ id: mentorConversations.id });

  return inserted.id;
}

/**
 * List conversations for a user.
 */
export async function listConversations(userId: string) {
  return db
    .select({
      id: mentorConversations.id,
      title: mentorConversations.title,
      learningObjectId: mentorConversations.learningObjectId,
      updatedAt: mentorConversations.updatedAt,
    })
    .from(mentorConversations)
    .where(eq(mentorConversations.userId, userId))
    .orderBy(mentorConversations.updatedAt)
    .limit(50);
}

/**
 * Get a single conversation with messages.
 */
export async function getConversation(conversationId: string, userId: string) {
  const [conv] = await db
    .select()
    .from(mentorConversations)
    .where(and(eq(mentorConversations.id, conversationId), eq(mentorConversations.userId, userId)))
    .limit(1);

  if (!conv) return null;

  let messages: MentorMessage[] = [];
  try {
    const parsed = JSON.parse(
      typeof conv.messages === "string" ? conv.messages : JSON.stringify(conv.messages)
    );
    messages = Array.isArray(parsed) ? parsed : [];
  } catch {
    messages = [];
  }

  return { ...conv, messages };
}

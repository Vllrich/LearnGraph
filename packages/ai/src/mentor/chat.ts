import { streamText, tool } from "ai";
import { z } from "zod";
import { anthropicModel } from "../models";
import { retrieveChunks, type RetrievedChunk } from "../rag";
import { db, mentorConversations, learningObjects } from "@repo/db";
import { eq, and } from "drizzle-orm";

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
- Format responses with markdown: use **bold** for key terms, bullet lists for steps, and code blocks when relevant.`;

export type MentorStreamOpts = {
  conversationId: string | null;
  userId: string;
  learningObjectId: string | null;
  message: string;
  history: MentorMessage[];
};

/**
 * Stream a mentor response with RAG-grounded context.
 * Returns a streamText result for the caller to pipe to the client.
 */
export async function streamMentorResponse(opts: MentorStreamOpts) {
  const { userId, learningObjectId, message, history } = opts;

  const chunks = await retrieveChunks(message, {
    learningObjectId: learningObjectId ?? undefined,
    topK: 5,
  });

  const contextBlock = chunks.length > 0
    ? chunks
        .map(
          (c, i) =>
            `[Chunk ${i + 1}${c.pageNumber ? `, p.${c.pageNumber}` : ""}]\n${c.content}`,
        )
        .join("\n\n---\n\n")
    : "No relevant content found in the user's materials.";

  const messages = [
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    {
      role: "user" as const,
      content: message,
    },
  ];

  const result = streamText({
    model: anthropicModel,
    system: `${SYSTEM_PROMPT}\n\n--- RETRIEVED CONTEXT ---\n${contextBlock}\n--- END CONTEXT ---`,
    messages,
    tools: {
      retrieve_content: tool({
        description: "Search for more relevant content from the user's learning materials",
        parameters: z.object({
          query: z.string().describe("Search query to find relevant content"),
        }),
        execute: async ({ query }) => {
          const moreChunks = await retrieveChunks(query, {
            learningObjectId: learningObjectId ?? undefined,
            topK: 3,
          });
          return moreChunks.map((c) => ({
            content: c.content.slice(0, 500),
            page: c.pageNumber,
          }));
        },
      }),
    },
    maxSteps: 3,
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
        and(
          eq(mentorConversations.id, conversationId),
          eq(mentorConversations.userId, userId),
        ),
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
    .where(
      and(
        eq(mentorConversations.id, conversationId),
        eq(mentorConversations.userId, userId),
      ),
    )
    .limit(1);

  if (!conv) return null;

  let messages: MentorMessage[] = [];
  try {
    const parsed = JSON.parse(typeof conv.messages === "string" ? conv.messages : JSON.stringify(conv.messages));
    messages = Array.isArray(parsed) ? parsed : [];
  } catch {
    messages = [];
  }

  return { ...conv, messages };
}

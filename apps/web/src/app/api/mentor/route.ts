import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  streamMentorResponse,
  saveConversation,
  type MentorMessage,
} from "@repo/ai";
import { db, learningObjects } from "@repo/db";
import { eq, and } from "drizzle-orm";

export const maxDuration = 60;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

const chatSchema = z.object({
  conversationId: z.string().uuid().nullable(),
  learningObjectId: z.string().uuid().nullable(),
  message: z.string().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(10_000),
        citations: z
          .array(
            z.object({
              chunkId: z.string(),
              content: z.string().max(500),
              pageNumber: z.number().nullable(),
              learningObjectId: z.string().optional(),
            }),
          )
          .optional(),
      }),
    )
    .max(50),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!checkRateLimit(user.id)) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded. Please wait a moment." }),
      { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "60" } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = chatSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid input", details: parsed.error.issues }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { conversationId, learningObjectId, message, history } = parsed.data;

  if (learningObjectId) {
    const [lo] = await db
      .select({ id: learningObjects.id })
      .from(learningObjects)
      .where(and(eq(learningObjects.id, learningObjectId), eq(learningObjects.userId, user.id)))
      .limit(1);
    if (!lo) {
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }
  }

  const { result, chunks } = await streamMentorResponse({
    conversationId,
    userId: user.id,
    learningObjectId,
    message,
    history,
  });

  const citations = chunks.map((c) => ({
    chunkId: c.id,
    content: c.content.slice(0, 200),
    pageNumber: c.pageNumber,
    learningObjectId: c.learningObjectId,
  }));

  const encoder = new TextEncoder();
  let fullResponse = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send citations as the first SSE event
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "citations", citations })}\n\n`),
        );

        for await (const chunk of result.textStream) {
          fullResponse += chunk;
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "text", text: chunk })}\n\n`),
          );
        }

        // Save the conversation after streaming completes
        const updatedHistory: MentorMessage[] = [
          ...history,
          { role: "user", content: message },
          { role: "assistant", content: fullResponse, citations },
        ];

        const savedId = await saveConversation({
          conversationId,
          userId: user.id,
          learningObjectId,
          messages: updatedHistory,
        });

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "done", conversationId: savedId })}\n\n`,
          ),
        );

        controller.close();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Streaming failed";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", error: message })}\n\n`),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

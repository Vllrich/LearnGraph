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
import { createLogger, checkRateLimit } from "@repo/shared";

const log = createLogger("api/mentor");

export const maxDuration = 60;

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

  const { allowed, retryAfterMs } = await checkRateLimit("mentor", user.id, { maxRequests: 20, window: "60 s" });
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded. Please wait a moment." }),
      { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } },
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

  log.info("Mentor request", { userId: user.id, learningObjectId, messageLen: message.length, historyLen: history.length });

  const { result, chunks } = await streamMentorResponse({
    conversationId,
    userId: user.id,
    learningObjectId,
    message,
    history,
  });

  log.debug("RAG retrieval done", { chunkCount: chunks.length, topScore: chunks[0]?.score });

  const citations = chunks
    .filter((c) => {
      const alphaNum = c.content.replace(/[^a-zA-Z0-9]/g, "");
      return alphaNum.length > 20;
    })
    .map((c) => ({
      chunkId: c.id,
      content: c.content.replace(/\s+/g, " ").trim().slice(0, 200),
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

        let chunkCount = 0;
        const toolCalls: string[] = [];
        for await (const part of result.fullStream) {
          if (part.type === "text-delta") {
            chunkCount++;
            fullResponse += part.textDelta;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "text", text: part.textDelta })}\n\n`),
            );
          } else if (part.type === "tool-call") {
            toolCalls.push(part.toolName);
            log.debug("Tool call", { tool: part.toolName, args: part.args });
          } else if (part.type === "tool-result") {
            log.debug("Tool result", { tool: (part as Record<string, unknown>).toolName });
          } else if (part.type === "error") {
            log.error("Stream error part", { error: part.error });
          } else if (part.type === "finish") {
            log.info("Stream complete", { chunkCount, responseLen: fullResponse.length, toolCalls });
          }
        }

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
        log.error("Mentor stream failed", { userId: user.id, error: message });
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

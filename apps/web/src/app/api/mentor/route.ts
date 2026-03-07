import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  streamMentorResponse,
  saveConversation,
  type MentorMessage,
} from "@repo/ai";

export const maxDuration = 60;

const chatSchema = z.object({
  conversationId: z.string().uuid().nullable(),
  learningObjectId: z.string().uuid().nullable(),
  message: z.string().min(1).max(4000),
  history: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
      citations: z
        .array(
          z.object({
            chunkId: z.string(),
            content: z.string(),
            pageNumber: z.number().nullable(),
          }),
        )
        .optional(),
    }),
  ),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const parsed = chatSchema.safeParse(await req.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid input" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { conversationId, learningObjectId, message, history } = parsed.data;

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

import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  streamTeach,
  generateCheck,
  streamFeedback,
  streamExplainBackPrompt,
  evaluateExplainBack,
  type SessionContext,
} from "@repo/ai";

export const maxDuration = 60;

const sessionSchema = z.object({
  action: z.enum(["teach", "check", "answer", "explain_back_prompt", "explain_back_answer"]),
  goalId: z.string().uuid(),
  topic: z.string().max(500),
  goalType: z.enum(["exam_prep", "skill_building", "course_supplement", "exploration"]),
  currentLevel: z.enum(["beginner", "some_knowledge", "experienced"]),
  conceptTitle: z.string().max(500),
  conceptDescription: z.string().max(2000),
  conceptIndex: z.number().min(0),
  totalConcepts: z.number().min(1),
  previousConcepts: z.array(z.string()).max(50),
  userAnswer: z.string().max(4000).optional(),
  question: z
    .object({
      type: z.enum(["mcq", "short_answer"]),
      options: z.array(z.string()).optional(),
      correctIndex: z.number().optional(),
      correctAnswer: z.string().optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const parsed = sessionSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid input", details: parsed.error.issues }), {
      status: 400,
    });
  }

  const { action, userAnswer, question, ...rest } = parsed.data;
  const ctx: SessionContext = {
    ...rest,
    sessionHistory: [],
  };

  const encoder = new TextEncoder();

  if (action === "teach") {
    const result = streamTeach(ctx);
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.textStream) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "text", text: chunk })}\n\n`)
            );
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
          controller.close();
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Stream failed";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", error: msg })}\n\n`)
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

  if (action === "check") {
    try {
      const questionData = await generateCheck(ctx);
      return new Response(JSON.stringify({ type: "check", question: questionData }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("[learn/session] Check generation failed:", err);
      return new Response(JSON.stringify({ error: "Failed to generate check" }), { status: 500 });
    }
  }

  if (action === "answer") {
    if (!userAnswer || !question) {
      return new Response(JSON.stringify({ error: "Missing userAnswer or question" }), {
        status: 400,
      });
    }

    const result = streamFeedback(ctx, userAnswer, question);
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.textStream) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "text", text: chunk })}\n\n`)
            );
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
          controller.close();
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Stream failed";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", error: msg })}\n\n`)
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

  if (action === "explain_back_prompt") {
    const result = streamExplainBackPrompt(ctx);
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.textStream) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "text", text: chunk })}\n\n`)
            );
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
          controller.close();
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Stream failed";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", error: msg })}\n\n`)
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

  if (action === "explain_back_answer") {
    if (!userAnswer) {
      return new Response(JSON.stringify({ error: "Missing explanation" }), { status: 400 });
    }

    try {
      const score = await evaluateExplainBack(ctx, userAnswer);
      return new Response(JSON.stringify({ type: "explain_back_score", score }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("[learn/session] Explain-back eval failed:", err);
      return new Response(JSON.stringify({ error: "Failed to evaluate" }), { status: 500 });
    }
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400 });
}

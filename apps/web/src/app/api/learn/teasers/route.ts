import { z } from "zod";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { generateTeaserCardsStream } from "@repo/ai";
import { checkRateLimit, categorizeGenerationError } from "@repo/shared";

/**
 * SSE endpoint powering <CourseGenerationCurtain />. Streams short
 * teaser cards in parallel with the main POST /api/learn/start-v2
 * call so the user has something meaningful to read during the
 * 45–60s Phase-1 wait.
 *
 * The stream is fire-and-forget from the client's perspective:
 * - Any error, timeout, or rate-limit simply ends the stream cleanly;
 *   the client falls back to its static generic cards.
 * - Graceful abort on client disconnect avoids wasted LLM tokens.
 */

export const maxDuration = 30;

const bodySchema = z.object({
  topic: z.string().trim().min(1).max(500),
  goalType: z.enum([
    "exam_prep",
    "skill_building",
    "course_supplement",
    "exploration",
  ]),
  currentLevel: z.enum(["beginner", "some_knowledge", "experienced"]),
  educationStage: z
    .enum([
      "elementary",
      "high_school",
      "university",
      "professional",
      "self_learner",
    ])
    .optional(),
});

const TEASER_TIMEOUT_MS = 8_000;

export async function POST(req: Request): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { allowed, retryAfterMs } = await checkRateLimit(
    "learn-teasers",
    user.id,
    { maxRequests: 10, window: "60 s" },
  );
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded" }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil(retryAfterMs / 1000)),
        },
      },
    );
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const abortCtrl = new AbortController();

  const parentSignal = req.signal;
  if (parentSignal) {
    if (parentSignal.aborted) abortCtrl.abort();
    else
      parentSignal.addEventListener("abort", () => abortCtrl.abort(), {
        once: true,
      });
  }

  const timeout = setTimeout(() => {
    abortCtrl.abort(new Error("teaser timeout"));
  }, TEASER_TIMEOUT_MS);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(
            `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
          ),
        );
      };

      try {
        for await (const card of generateTeaserCardsStream(parsed, {
          signal: abortCtrl.signal,
        })) {
          write("card", card);
        }
        write("done", { ok: true });
      } catch (err) {
        const correlationId = randomUUID().slice(0, 8);
        const reason = categorizeGenerationError(err);
        console.warn(
          `[learn/teasers] stream failed [${correlationId}] (${reason})`,
          err,
        );
        try {
          write("error", { reason, correlationId });
        } catch {
          /* controller may already be closed */
        }
      } finally {
        clearTimeout(timeout);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
    cancel() {
      clearTimeout(timeout);
      abortCtrl.abort();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

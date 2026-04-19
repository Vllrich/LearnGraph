import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import {
  generateCourseSkeleton,
  completeCourseGeneration,
  MAX_GENERATION_ERROR_LENGTH,
  type CourseSkeleton,
} from "@repo/ai";
import { db, learningGoals } from "@repo/db";
import { eq } from "drizzle-orm";
import {
  checkRateLimit,
  LEARNING_MODES,
  categorizeGenerationError,
  formatStoredGenerationError,
} from "@repo/shared";
import type { GoalType } from "@repo/shared";

export const maxDuration = 300;

const startV2Schema = z.object({
  topic: z.string().min(1).max(500),
  goalType: z.enum(["exam_prep", "skill_building", "course_supplement", "exploration"]),
  currentLevel: z.enum(["beginner", "some_knowledge", "experienced"]),
  learningMode: z.enum(LEARNING_MODES),
  educationStage: z.enum(["elementary", "high_school", "university", "professional", "self_learner"]).optional(),
  selectedTopics: z.array(z.object({ title: z.string().max(200), description: z.string().max(500) })).max(30).optional(),
  sessionMinutes: z.number().min(5).max(60).optional(),
  daysPerWeek: z.number().min(1).max(7).optional(),
  targetDate: z.string().optional(),
  examDate: z.string().optional(),
  examName: z.string().max(200).optional(),
  contextNote: z.string().max(500).optional(),
});

const COVER_STYLE: Record<GoalType, string> = {
  exam_prep: "focused academic study, structured grids, bold geometric shapes, deep blue and gold",
  skill_building: "hands-on craft and tools, energetic diagonal lines, teal and orange",
  course_supplement: "open knowledge network, flowing connections, soft purple and green",
  exploration: "cosmic curiosity, abstract universe, swirling gradients, deep purple and cyan",
};

async function fetchCoverImageB64(topic: string, goalType: GoalType): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const sanitizedTopic = topic.replace(/[^\w\s,.-]/g, "").slice(0, 100);
  const prompt = `Stunning minimalist course cover art for "${sanitizedTopic}". Style: ${COVER_STYLE[goalType]}. Abstract geometric illustration, vibrant complementary colors, no text, no letters, no numbers, clean modern design, digital course thumbnail, wide landscape format.`;

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1792x1024",
      quality: "standard",
      response_format: "b64_json",
    }),
  });

  if (!res.ok) {
    console.warn("[learn/start-v2] DALL-E failed:", res.status);
    return null;
  }

  const json = (await res.json()) as { data?: { b64_json?: string }[] };
  return json?.data?.[0]?.b64_json ?? null;
}

async function uploadCoverImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  b64: string,
  goalId: string,
): Promise<string | null> {
  const binary = Buffer.from(b64, "base64");
  const path = `${goalId}.png`;

  const { error } = await supabase.storage.from("course-covers").upload(path, binary, {
    contentType: "image/png",
    upsert: true,
  });

  if (error) {
    console.warn("[learn/start-v2] Upload failed:", error.message);
    return null;
  }

  const { data } = supabase.storage.from("course-covers").getPublicUrl(path);
  return data?.publicUrl ?? null;
}

/**
 * Fire-and-forget cover image generation. Runs alongside Phase 2 so it is
 * never on the user's critical path, and errors never propagate out — a
 * failed cover image should not flip the goal to `generation_status=failed`.
 */
async function generateAndSaveCoverImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  goalId: string,
  topic: string,
  goalType: GoalType,
): Promise<void> {
  try {
    const b64 = await fetchCoverImageB64(topic, goalType);
    if (!b64) return;
    const publicUrl = await uploadCoverImage(supabase, b64, goalId);
    if (!publicUrl) return;
    await db
      .update(learningGoals)
      .set({ coverImageUrl: publicUrl })
      .where(eq(learningGoals.id, goalId));
  } catch (err) {
    console.warn("[learn/start-v2] cover image generation failed:", err);
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed, retryAfterMs } = await checkRateLimit("start-v2", user.id, { maxRequests: 3, window: "60 s" });
  if (!allowed) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = startV2Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 },
    );
  }

  let skeleton: CourseSkeleton;
  try {
    skeleton = await generateCourseSkeleton({
      ...parsed.data,
      userId: user.id,
      learnerProfile: null,
    });
  } catch (err) {
    console.error("[learn/start-v2] skeleton (phase 1) failed:", err);
    return NextResponse.json(
      { error: "Failed to start course generation" },
      { status: 500 },
    );
  }

  // Phase 2 runs AFTER the HTTP response has flushed. `after()` keeps the
  // serverless function alive so we can finish Module 2..N's lessons, every
  // remaining block outline, and the DALL-E cover image without blocking the
  // client. A Phase 2 failure is recorded on the goal row (status='failed' +
  // a *categorized* generation_error — never a raw SDK message, to avoid
  // leaking prompts / schema details to the UI) so the UI can surface it.
  // The cover image failure is non-fatal — `generateAndSaveCoverImage`
  // swallows its own errors.
  after(async () => {
    const coverPromise = generateAndSaveCoverImage(
      supabase,
      skeleton.goalId,
      skeleton.topic,
      skeleton.goalType,
    );
    try {
      await completeCourseGeneration(skeleton);
    } catch (err) {
      const correlationId = randomUUID().slice(0, 8);
      const reason = categorizeGenerationError(err);
      console.error(
        `[learn/start-v2] phase 2 failed [${correlationId}] (${reason}):`,
        err,
      );
      try {
        await db
          .update(learningGoals)
          .set({
            generationStatus: "failed",
            generationError: formatStoredGenerationError(
              reason,
              correlationId,
            ).slice(0, MAX_GENERATION_ERROR_LENGTH),
          })
          .where(eq(learningGoals.id, skeleton.goalId));
      } catch (updateErr) {
        console.error(
          `[learn/start-v2] failed to record phase-2 error [${correlationId}]:`,
          updateErr,
        );
      }
    }
    // Let the cover-image task finish before `after()` releases the
    // invocation. Cover errors are already swallowed internally so this
    // `await` never rejects. Note: the status flip to 'ready' happens at
    // the tail of `completeCourseGeneration`, so a cover image uploaded
    // here after the flip shows up on the next roadmap refetch — acceptable
    // because the cover is decorative.
    await coverPromise;
  });

  return NextResponse.json({
    goalId: skeleton.goalId,
    moduleCount: skeleton.moduleCount,
    schemaVersion: 2,
  });
}

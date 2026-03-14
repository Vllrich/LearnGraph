import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateModularCourse } from "@repo/ai";
import { db, learningGoals } from "@repo/db";
import { eq } from "drizzle-orm";
import { LEARNING_MODES } from "@repo/shared";
import type { GoalType } from "@repo/shared";

export const maxDuration = 300;

const rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 3;

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

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = Date.now();
  const rl = rateMap.get(user.id);
  if (!rl || now > rl.resetAt) {
    rateMap.set(user.id, { count: 1, resetAt: now + RATE_WINDOW_MS });
  } else if (rl.count >= RATE_MAX) {
    return NextResponse.json({ error: "Rate limit exceeded" }, {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  } else {
    rl.count++;
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

  try {
    const [result, imageB64] = await Promise.all([
      generateModularCourse({
        ...parsed.data,
        userId: user.id,
        learnerProfile: null,
      }),
      fetchCoverImageB64(parsed.data.topic, parsed.data.goalType),
    ]);

    if (imageB64) {
      const publicUrl = await uploadCoverImage(supabase, imageB64, result.goal.id);
      if (publicUrl) {
        await db
          .update(learningGoals)
          .set({ coverImageUrl: publicUrl })
          .where(eq(learningGoals.id, result.goal.id));
      }
    }

    return NextResponse.json({
      goalId: result.goal.id,
      moduleCount: result.moduleCount,
      schemaVersion: 2,
    });
  } catch (err) {
    console.error("[learn/start-v2] Failed:", err);
    return NextResponse.json({ error: "Failed to generate course" }, { status: 500 });
  }
}

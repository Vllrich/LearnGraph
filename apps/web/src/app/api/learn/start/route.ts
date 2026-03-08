import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateCurriculum } from "@repo/ai";
import { db, learningGoals } from "@repo/db";
import { eq } from "drizzle-orm";
import type { GoalType } from "@repo/shared";

export const maxDuration = 60;

const methodPreferencesSchema = z.object({
  guidedLessons: z.number().min(0).max(100),
  practiceTesting: z.number().min(0).max(100),
  explainBack: z.number().min(0).max(100),
  spacedReview: z.number().min(0).max(100),
});

const selectedTopicSchema = z.object({
  title: z.string(),
  description: z.string(),
});

const startSchema = z.object({
  topic: z.string().min(1).max(500),
  goalType: z.enum(["exam_prep", "skill_building", "course_supplement", "exploration"]),
  currentLevel: z.enum(["beginner", "some_knowledge", "experienced"]),
  timeBudgetMinutes: z.number().min(5).max(480).optional(),
  educationStage: z.enum(["elementary", "high_school", "university", "professional", "self_learner"]).optional(),
  selectedTopics: z.array(selectedTopicSchema).optional(),
  methodPreferences: methodPreferencesSchema.optional(),
  focusMode: z.enum(["concept_mastery", "breadth", "exam_readiness"]).optional(),
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

/** Step 1: call DALL-E 3, return raw base64. No goalId needed yet. */
async function fetchCoverImageB64(topic: string, goalType: GoalType): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const prompt = `Stunning minimalist course cover art for "${topic}". Style: ${COVER_STYLE[goalType]}. Abstract geometric illustration, vibrant complementary colors, no text, no letters, no numbers, clean modern design, digital course thumbnail, wide landscape format.`;

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
    console.warn("[learn/start] DALL-E failed:", res.status, await res.text());
    return null;
  }

  const json = (await res.json()) as { data?: { b64_json?: string }[] };
  return json?.data?.[0]?.b64_json ?? null;
}

/** Step 2: upload base64 image to Supabase storage, return public URL. */
async function uploadCoverImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  b64: string,
  goalId: string
): Promise<string | null> {
  const binary = Buffer.from(b64, "base64");
  const path = `${goalId}.png`;

  const { error } = await supabase.storage.from("course-covers").upload(path, binary, {
    contentType: "image/png",
    upsert: true,
  });

  if (error) {
    console.warn("[learn/start] Storage upload failed:", error.message);
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

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const {
    topic, goalType, currentLevel, timeBudgetMinutes,
    educationStage, selectedTopics, methodPreferences, focusMode,
    sessionMinutes, daysPerWeek, targetDate, examDate, examName, contextNote,
  } = parsed.data;

  try {
    const [{ goal, items }, imageB64] = await Promise.all([
      generateCurriculum({
        topic, goalType, currentLevel, userId: user.id, timeBudgetMinutes,
        educationStage, selectedTopics, methodPreferences, focusMode,
        sessionMinutes, daysPerWeek, targetDate, examDate, examName, contextNote,
      }),
      fetchCoverImageB64(topic, goalType),
    ]);

    // Upload image and persist URL if generation succeeded
    if (imageB64) {
      const publicUrl = await uploadCoverImage(supabase, imageB64, goal.id);
      if (publicUrl) {
        await db
          .update(learningGoals)
          .set({ coverImageUrl: publicUrl })
          .where(eq(learningGoals.id, goal.id));
        goal.coverImageUrl = publicUrl;
      }
    }

    return NextResponse.json({ goalId: goal.id, goal, items });
  } catch (err) {
    console.error("[learn/start] Failed:", err);
    return NextResponse.json({ error: "Failed to generate curriculum" }, { status: 500 });
  }
}

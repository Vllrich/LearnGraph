import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateCurriculum } from "@repo/ai";

export const maxDuration = 60;

const startSchema = z.object({
  topic: z.string().min(1).max(500),
  goalType: z.enum(["exam_prep", "skill_building", "course_supplement", "exploration"]),
  currentLevel: z.enum(["beginner", "some_knowledge", "experienced"]),
  timeBudgetMinutes: z.number().min(5).max(480).optional(),
});

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

  try {
    const { goal, items } = await generateCurriculum({
      ...parsed.data,
      userId: user.id,
    });

    return NextResponse.json({ goalId: goal.id, goal, items });
  } catch (err) {
    console.error("[learn/start] Curriculum generation failed:", err);
    return NextResponse.json({ error: "Failed to generate curriculum" }, { status: 500 });
  }
}

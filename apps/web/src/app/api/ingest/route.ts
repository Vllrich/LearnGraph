import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { runIngestionPipeline } from "@repo/ai";
import { db, learningObjects } from "@repo/db";
import { eq, and } from "drizzle-orm";

export const maxDuration = 300;

const ingestSchema = z.object({
  learningObjectId: z.string().uuid(),
  sourceType: z.enum(["pdf", "youtube"]),
  filePath: z.string().optional(),
  sourceUrl: z.string().url().optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = ingestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { learningObjectId, sourceType, filePath, sourceUrl } = parsed.data;

  const [owned] = await db
    .select({ id: learningObjects.id })
    .from(learningObjects)
    .where(
      and(
        eq(learningObjects.id, learningObjectId),
        eq(learningObjects.userId, user.id),
      ),
    )
    .limit(1);

  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let fileBuffer: Buffer | undefined;

  if (sourceType === "pdf" && filePath) {
    const { data, error } = await supabase.storage
      .from("content-uploads")
      .download(filePath);

    if (error || !data) {
      return NextResponse.json(
        { error: "Failed to download file from storage" },
        { status: 500 },
      );
    }

    fileBuffer = Buffer.from(await data.arrayBuffer());
  }

  after(
    runIngestionPipeline({
      learningObjectId,
      sourceType,
      fileBuffer,
      sourceUrl,
    }),
  );

  return NextResponse.json({ status: "processing" });
}

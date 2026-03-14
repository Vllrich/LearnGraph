import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { runIngestionPipeline } from "@repo/ai";
import { db, learningObjects } from "@repo/db";
import { eq, and } from "drizzle-orm";
import { checkRateLimit } from "@repo/shared";

export const maxDuration = 300;

const FILE_SOURCE_TYPES = ["pdf", "docx", "pptx", "audio", "image"] as const;
const URL_SOURCE_TYPES = ["youtube", "url"] as const;

const ingestSchema = z.object({
  learningObjectId: z.string().uuid(),
  sourceType: z.enum([...FILE_SOURCE_TYPES, ...URL_SOURCE_TYPES]),
  filePath: z.string().max(500).optional(),
  sourceUrl: z.string().url().max(2048).optional(),
  fileName: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { allowed, retryAfterMs } = await checkRateLimit("ingest", user.id, { maxRequests: 5, window: "60 s" });
  if (!allowed) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
    });
  }

  const parsed = ingestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { learningObjectId, sourceType, filePath, sourceUrl, fileName } = parsed.data;

  const [owned] = await db
    .select({ id: learningObjects.id })
    .from(learningObjects)
    .where(and(eq(learningObjects.id, learningObjectId), eq(learningObjects.userId, user.id)))
    .limit(1);

  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let fileBuffer: Buffer | undefined;

  const isFileType = (FILE_SOURCE_TYPES as readonly string[]).includes(sourceType);
  if (isFileType && filePath) {
    const { data, error } = await supabase.storage.from("content-uploads").download(filePath);

    if (error || !data) {
      return NextResponse.json({ error: "Failed to download file from storage" }, { status: 500 });
    }

    fileBuffer = Buffer.from(await data.arrayBuffer());
  }

  after(
    runIngestionPipeline({
      learningObjectId,
      sourceType,
      fileBuffer,
      sourceUrl,
      fileName,
    })
  );

  return NextResponse.json({ status: "processing" });
}

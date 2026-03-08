import { db, learningObjects, contentChunks } from "@repo/db";
import { eq, sql } from "drizzle-orm";
import { extractPdfText } from "./pdf";
import { fetchYoutubeTranscript } from "./youtube";
import { extractDocxText } from "./docx";
import { extractPptxText } from "./pptx";
import { transcribeAudio } from "./audio";
import { extractWebUrl } from "./web-url";
import { extractImageContent } from "./image";
import { semanticChunk } from "./chunker";
import { generateEmbeddings } from "./embeddings";
import { summarizeContent } from "./summarize";
import { extractAndStoreConcepts } from "./concepts";
import { generateQuizForLearningObject } from "../quiz/generate";
import type { SourceType } from "@repo/shared";

export type PipelineInput = {
  learningObjectId: string;
  sourceType: SourceType;
  fileBuffer?: Buffer;
  sourceUrl?: string;
  fileName?: string;
};

/**
 * Full ingestion pipeline: extract → chunk → embed + summarize + extract concepts.
 * Updates learning_objects status throughout.
 */
export async function runIngestionPipeline(input: PipelineInput): Promise<void> {
  const { learningObjectId, sourceType, fileBuffer, sourceUrl } = input;

  const updateStatus = async (status: string, error?: string) => {
    await db
      .update(learningObjects)
      .set({
        status,
        ...(error ? { metadata: { error } } : {}),
        updatedAt: new Date(),
      })
      .where(eq(learningObjects.id, learningObjectId));
  };

  try {
    // Step 1: Extract text based on source type
    let rawText: string;
    let title: string | null = null;
    let metadata: Record<string, unknown> = {};
    let pageOffsets: Map<number, number> | undefined;

    if (sourceType === "pdf" && fileBuffer) {
      const result = await extractPdfText(fileBuffer);
      rawText = result.text;
      title = result.title;
      metadata = { pageCount: result.pageCount };
      pageOffsets = result.pageOffsets;
    } else if (sourceType === "youtube" && sourceUrl) {
      const result = await fetchYoutubeTranscript(sourceUrl);
      rawText = result.text;
      title = result.title;
      metadata = {
        videoId: result.videoId,
        duration: result.duration,
        channelName: result.channelName,
        thumbnailUrl: result.thumbnailUrl,
      };
    } else if (sourceType === "docx" && fileBuffer) {
      const result = await extractDocxText(fileBuffer);
      rawText = result.text;
      title = result.title;
      metadata = { format: "docx" };
    } else if (sourceType === "pptx" && fileBuffer) {
      const result = await extractPptxText(fileBuffer);
      rawText = result.text;
      title = result.title;
      metadata = { slideCount: result.slideCount, format: "pptx" };
    } else if (sourceType === "audio" && fileBuffer) {
      const result = await transcribeAudio(fileBuffer, input.fileName ?? "audio.mp3");
      rawText = result.text;
      title = result.title;
      metadata = { durationSeconds: result.durationSeconds, format: "audio" };
    } else if (sourceType === "url" && sourceUrl) {
      const result = await extractWebUrl(sourceUrl);
      rawText = result.text;
      title = result.title;
      metadata = { siteName: result.siteName, originalUrl: result.url, format: "web" };
    } else if (sourceType === "image" && fileBuffer) {
      const result = await extractImageContent(fileBuffer, input.fileName ?? "image.png");
      rawText = result.text;
      title = result.title;
      metadata = { format: "image" };
    } else {
      throw new Error(`Unsupported source type: ${sourceType}`);
    }

    if (rawText.length < 100) {
      throw new Error("Extracted text is too short. The document may be empty or unreadable.");
    }

    await db
      .update(learningObjects)
      .set({
        rawText,
        ...(title ? { title } : {}),
        metadata,
        updatedAt: new Date(),
      })
      .where(eq(learningObjects.id, learningObjectId));

    // Step 2: Semantic chunking
    const chunks = semanticChunk(rawText, { pageNumbers: pageOffsets });

    if (chunks.length === 0) {
      throw new Error("No chunks produced from document.");
    }

    const insertedChunks = await db
      .insert(contentChunks)
      .values(
        chunks.map((c) => ({
          learningObjectId,
          chunkIndex: c.chunkIndex,
          content: c.content,
          sectionTitle: c.sectionTitle,
          pageNumber: c.pageNumber,
          tokenCount: c.tokenCount,
        }))
      )
      .returning({ id: contentChunks.id });

    const chunkIds = insertedChunks.map((c) => c.id);

    // Step 3: Run embeddings, summarization, and concept extraction in parallel
    const [embeddings, summary, conceptIds] = await Promise.all([
      generateEmbeddings(chunks.map((c) => c.content)),
      summarizeContent(rawText, title ?? "Untitled"),
      extractAndStoreConcepts(chunks, learningObjectId, chunkIds),
    ]);

    // Step 4: Store embeddings on chunks
    await Promise.all(
      embeddings.map((emb, i) =>
        db.update(contentChunks).set({ embedding: emb }).where(eq(contentChunks.id, chunkIds[i]))
      )
    );

    // Step 5: Count cross-source connections for the notification
    let crossSourceCount = 0;
    if (conceptIds.length > 0) {
      const crossLinks = await db.execute<{ cnt: number }>(
        sql`SELECT COUNT(DISTINCT cc2.learning_object_id)::int AS cnt
            FROM concept_chunk_links ccl
            JOIN content_chunks cc2 ON ccl.chunk_id = cc2.id
            WHERE ccl.concept_id = ANY(ARRAY[${sql.join(
              conceptIds.map((id) => sql`${id}::uuid`),
              sql`, `
            )}])
            AND cc2.learning_object_id != ${learningObjectId}`
      );
      const rows = Array.isArray(crossLinks) ? crossLinks : [];
      crossSourceCount = rows.length > 0 ? Number(rows[0].cnt) : 0;
    }

    // Step 6: Store summaries + connection count
    await db
      .update(learningObjects)
      .set({
        summaryTldr: summary.tldr,
        summaryKeyPoints: JSON.stringify(summary.keyPoints),
        summaryDeep: summary.deepSummary,
        status: "ready",
        metadata: {
          ...metadata,
          crossSourceConnections: crossSourceCount,
          conceptCount: conceptIds.length,
        },
        updatedAt: new Date(),
      })
      .where(eq(learningObjects.id, learningObjectId));

    // Step 7: Generate quiz bank (non-blocking — failure here doesn't fail the pipeline)
    try {
      await generateQuizForLearningObject(learningObjectId);
    } catch (quizErr) {
      console.error(
        `Quiz generation failed for ${learningObjectId}:`,
        quizErr instanceof Error ? quizErr.message : quizErr
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown processing error";
    console.error(`Pipeline failed for ${learningObjectId}:`, message);
    await updateStatus("failed", message);
  }
}

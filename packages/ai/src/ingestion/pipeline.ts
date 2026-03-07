import { db, learningObjects, contentChunks } from "@repo/db";
import { eq } from "drizzle-orm";
import { extractPdfText } from "./pdf";
import { fetchYoutubeTranscript } from "./youtube";
import { semanticChunk } from "./chunker";
import { generateEmbeddings } from "./embeddings";
import { summarizeContent } from "./summarize";
import { extractAndStoreConcepts } from "./concepts";
import type { SourceType } from "@repo/shared";

export type PipelineInput = {
  learningObjectId: string;
  sourceType: SourceType;
  fileBuffer?: Buffer;
  sourceUrl?: string;
};

/**
 * Full ingestion pipeline: extract → chunk → embed + summarize + extract concepts.
 * Updates learning_objects status throughout.
 */
export async function runIngestionPipeline(
  input: PipelineInput,
): Promise<void> {
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
    // Step 1: Extract text
    let rawText: string;
    let title: string | null = null;
    let metadata: Record<string, unknown> = {};

    if (sourceType === "pdf" && fileBuffer) {
      const result = await extractPdfText(fileBuffer);
      rawText = result.text;
      title = result.title;
      metadata = { pageCount: result.pageCount };
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
    } else {
      throw new Error(`Unsupported source type: ${sourceType}`);
    }

    if (rawText.length < 100) {
      throw new Error(
        "Extracted text is too short. The document may be empty or unreadable.",
      );
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
    const chunks = semanticChunk(rawText);

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
        })),
      )
      .returning({ id: contentChunks.id });

    const chunkIds = insertedChunks.map((c) => c.id);

    // Step 3: Run embeddings, summarization, and concept extraction in parallel
    const [embeddings, summary] = await Promise.all([
      generateEmbeddings(chunks.map((c) => c.content)),
      summarizeContent(rawText, title ?? "Untitled"),
      extractAndStoreConcepts(chunks, learningObjectId, chunkIds),
    ]);

    // Step 4: Store embeddings on chunks
    await Promise.all(
      embeddings.map((emb, i) =>
        db
          .update(contentChunks)
          .set({ embedding: emb })
          .where(eq(contentChunks.id, chunkIds[i])),
      ),
    );

    // Step 5: Store summaries
    await db
      .update(learningObjects)
      .set({
        summaryTldr: summary.tldr,
        summaryKeyPoints: JSON.stringify(summary.keyPoints),
        summaryDeep: summary.deepSummary,
        status: "ready",
        updatedAt: new Date(),
      })
      .where(eq(learningObjects.id, learningObjectId));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown processing error";
    console.error(`Pipeline failed for ${learningObjectId}:`, message);
    await updateStatus("failed", message);
  }
}

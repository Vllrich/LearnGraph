import { generateObject } from "ai";
import { z } from "zod";
import { primaryModel } from "../models";
import { withParseRetry } from "../robust-generate";
import { generateEmbedding } from "./embeddings";
import { db } from "@repo/db";
import { concepts, conceptEdges, conceptChunkLinks } from "@repo/db";
import { eq, sql } from "drizzle-orm";
import { CONCEPT_SIMILARITY_THRESHOLD } from "@repo/shared";
import type { Chunk } from "./chunker";

const extractionSchema = z.object({
  concepts: z.array(
    z.object({
      name: z.string().describe("Canonical concept name (lowercase, singular)"),
      displayName: z.string().describe("Human-readable display name"),
      definition: z.string().describe("1-2 sentence definition from the source"),
      prerequisites: z.array(z.string()).describe("Names of concepts this depends on"),
      relatedTo: z.array(z.string()).describe("Names of related concepts"),
      difficultyLevel: z.number().int().min(1).max(5).describe("1=basic, 5=advanced"),
      bloomLevel: z.enum(["remember", "understand", "apply", "analyze", "evaluate", "create"]),
    })
  ),
});

export type ExtractedConcept = z.infer<typeof extractionSchema>["concepts"][number];

/**
 * Extract concepts from content chunks using LLM, then deduplicate and store.
 */
export async function extractAndStoreConcepts(
  chunks: Chunk[],
  learningObjectId: string,
  storedChunkIds: string[]
): Promise<string[]> {
  const batchSize = 5;
  const allExtracted: { concept: ExtractedConcept; chunkIndices: number[] }[] = [];

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const batchText = batch.map((c, j) => `[Chunk ${i + j}]\n${c.content}`).join("\n\n---\n\n");

    const { object } = await withParseRetry(() =>
      generateObject({
        model: primaryModel,
        schema: extractionSchema,
        prompt: `Extract key concepts from these chunks. Provide canonical name (lowercase singular), definition from text, prerequisites, related concepts, difficulty (1-5), Bloom level.
Only extract concepts explicitly in text.

${batchText}`,
        temperature: 0.2,
      })
    );

    for (const concept of object.concepts) {
      const chunkIndices = batch.map((_, j) => i + j);
      allExtracted.push({ concept, chunkIndices });
    }
  }

  const mergedConcepts = deduplicateExtracted(allExtracted);
  const conceptIds: string[] = [];

  for (const { concept, chunkIndices } of mergedConcepts) {
    const conceptId = await upsertConcept(concept);
    conceptIds.push(conceptId);

    for (const idx of chunkIndices) {
      if (idx < storedChunkIds.length) {
        await db
          .insert(conceptChunkLinks)
          .values({
            conceptId,
            chunkId: storedChunkIds[idx],
            relevanceScore: 1.0,
          })
          .onConflictDoNothing();
      }
    }

    for (const prereq of concept.prerequisites) {
      const prereqId = await findOrCreateConceptByName(prereq);
      if (prereqId && prereqId !== conceptId) {
        await db
          .insert(conceptEdges)
          .values({
            sourceId: prereqId,
            targetId: conceptId,
            edgeType: "prerequisite",
            sourceOrigin: "ai",
          })
          .onConflictDoNothing();
      }
    }

    for (const related of concept.relatedTo) {
      const relatedId = await findOrCreateConceptByName(related);
      if (relatedId && relatedId !== conceptId) {
        await db
          .insert(conceptEdges)
          .values({
            sourceId: conceptId,
            targetId: relatedId,
            edgeType: "related_to",
            sourceOrigin: "ai",
          })
          .onConflictDoNothing();
      }
    }
  }

  return conceptIds;
}

function deduplicateExtracted(
  items: { concept: ExtractedConcept; chunkIndices: number[] }[]
): { concept: ExtractedConcept; chunkIndices: number[] }[] {
  const seen = new Map<string, { concept: ExtractedConcept; chunkIndices: number[] }>();

  for (const item of items) {
    const key = item.concept.name.toLowerCase().trim();
    const existing = seen.get(key);
    if (existing) {
      existing.chunkIndices.push(...item.chunkIndices);
      if (item.concept.definition.length > existing.concept.definition.length) {
        existing.concept.definition = item.concept.definition;
      }
    } else {
      seen.set(key, { ...item, chunkIndices: [...item.chunkIndices] });
    }
  }

  return Array.from(seen.values());
}

async function upsertConcept(extracted: ExtractedConcept): Promise<string> {
  const canonical = extracted.name.toLowerCase().trim().replace(/\s+/g, "_");

  const existing = await db
    .select()
    .from(concepts)
    .where(eq(concepts.canonicalName, canonical))
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  const embedding = await generateEmbedding(`${extracted.name}: ${extracted.definition}`);

  const vecLiteral = `[${embedding.join(",")}]`;
  const similar = await db.execute<{
    id: string;
    similarity: number;
  }>(sql`
    SELECT id, 1 - (embedding <=> ${vecLiteral}::vector) as similarity
    FROM concepts
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> ${vecLiteral}::vector
    LIMIT 1
  `);

  const rows = Array.isArray(similar) ? similar : [];
  if (rows.length > 0 && Number(rows[0].similarity) >= CONCEPT_SIMILARITY_THRESHOLD) {
    return rows[0].id;
  }

  const [inserted] = await db
    .insert(concepts)
    .values({
      canonicalName: canonical,
      displayName: extracted.displayName,
      definition: extracted.definition,
      difficultyLevel: extracted.difficultyLevel,
      bloomLevel: extracted.bloomLevel,
      embedding,
    })
    .returning({ id: concepts.id });

  return inserted.id;
}

async function findOrCreateConceptByName(name: string): Promise<string | null> {
  const canonical = name.toLowerCase().trim().replace(/\s+/g, "_");
  if (!canonical) return null;

  const existing = await db
    .select({ id: concepts.id })
    .from(concepts)
    .where(eq(concepts.canonicalName, canonical))
    .limit(1);

  if (existing.length > 0) return existing[0].id;

  const [inserted] = await db
    .insert(concepts)
    .values({
      canonicalName: canonical,
      displayName: name.trim(),
    })
    .returning({ id: concepts.id });

  return inserted.id;
}

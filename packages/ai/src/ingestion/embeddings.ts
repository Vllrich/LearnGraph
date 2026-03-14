import { embedMany } from "ai";
import { createHash } from "crypto";
import { embeddingModel } from "../models";
import { getRedisClient } from "@repo/shared";

const BATCH_SIZE = 100;

function embeddingCacheKey(text: string): string {
  return `emb:${createHash("sha256").update(text).digest("hex").slice(0, 32)}`;
}

/**
 * Generate embeddings for an array of texts.
 * Batches to avoid API limits. Returns embeddings in same order as input.
 * Uses Redis cache for previously computed embeddings.
 */
export async function generateEmbeddings(
  texts: string[],
): Promise<number[][]> {
  const redis = getRedisClient();
  const results: (number[] | null)[] = new Array(texts.length).fill(null);
  const uncachedIndices: number[] = [];

  // Check cache for all texts
  if (redis) {
    try {
      const keys = texts.map(embeddingCacheKey);
      const cached = await Promise.all(keys.map((k) => redis.get<number[]>(k)));
      for (let i = 0; i < cached.length; i++) {
        if (cached[i]) {
          results[i] = cached[i];
        } else {
          uncachedIndices.push(i);
        }
      }
    } catch {
      for (let i = 0; i < texts.length; i++) {
        if (!results[i]) uncachedIndices.push(i);
      }
    }
  } else {
    for (let i = 0; i < texts.length; i++) uncachedIndices.push(i);
  }

  // Generate embeddings for uncached texts
  if (uncachedIndices.length > 0) {
    const uncachedTexts = uncachedIndices.map((i) => texts[i]);
    const generated: number[][] = [];

    for (let i = 0; i < uncachedTexts.length; i += BATCH_SIZE) {
      const batch = uncachedTexts.slice(i, i + BATCH_SIZE);
      const { embeddings } = await embedMany({ model: embeddingModel, values: batch });
      generated.push(...embeddings);
    }

    for (let j = 0; j < uncachedIndices.length; j++) {
      results[uncachedIndices[j]] = generated[j];
    }

    // Store in cache (fire-and-forget)
    if (redis) {
      const cacheOps = uncachedIndices.map((idx, j) =>
        redis.set(embeddingCacheKey(texts[idx]), JSON.stringify(generated[j])).catch(() => {}),
      );
      Promise.all(cacheOps).catch(() => {});
    }
  }

  return results as number[][];
}

/**
 * Generate a single embedding for one text.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const [embedding] = await generateEmbeddings([text]);
  return embedding;
}

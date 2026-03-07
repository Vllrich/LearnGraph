import { embedMany } from "ai";
import { embeddingModel } from "../models";

const BATCH_SIZE = 100;

/**
 * Generate embeddings for an array of texts.
 * Batches to avoid API limits. Returns embeddings in same order as input.
 */
export async function generateEmbeddings(
  texts: string[],
): Promise<number[][]> {
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const { embeddings } = await embedMany({
      model: embeddingModel,
      values: batch,
    });
    allEmbeddings.push(...embeddings);
  }

  return allEmbeddings;
}

/**
 * Generate a single embedding for one text.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const [embedding] = await generateEmbeddings([text]);
  return embedding;
}

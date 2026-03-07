import { db, contentChunks } from "@repo/db";
import { eq, sql, and } from "drizzle-orm";
import { generateEmbedding } from "../ingestion/embeddings";
import { RAG_TOP_K, RAG_VECTOR_WEIGHT, RAG_BM25_WEIGHT } from "@repo/shared";

export type RetrievedChunk = {
  id: string;
  content: string;
  sectionTitle: string | null;
  pageNumber: number | null;
  learningObjectId: string;
  score: number;
};

/**
 * Hybrid search: vector similarity (pgvector cosine) + BM25-style full-text match.
 * Weighted combination: 0.7 vector + 0.3 keyword.
 */
export async function retrieveChunks(
  query: string,
  opts: {
    learningObjectId?: string;
    topK?: number;
  } = {},
): Promise<RetrievedChunk[]> {
  const topK = opts.topK ?? RAG_TOP_K;
  const queryEmbedding = await generateEmbedding(query);
  const vecLiteral = `[${queryEmbedding.join(",")}]`;

  const tsQuery = query
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .join(" & ");

  const scopeFilter = opts.learningObjectId
    ? sql`AND c.learning_object_id = ${opts.learningObjectId}`
    : sql``;

  const results = await db.execute<{
    id: string;
    content: string;
    section_title: string | null;
    page_number: number | null;
    learning_object_id: string;
    vector_score: number;
    text_score: number;
    combined_score: number;
  }>(sql`
    WITH vector_search AS (
      SELECT
        c.id,
        c.content,
        c.section_title,
        c.page_number,
        c.learning_object_id,
        1 - (c.embedding <=> ${vecLiteral}::vector) AS vector_score
      FROM content_chunks c
      WHERE c.embedding IS NOT NULL ${scopeFilter}
      ORDER BY c.embedding <=> ${vecLiteral}::vector
      LIMIT ${topK * 3}
    ),
    text_search AS (
      SELECT
        c.id,
        ts_rank_cd(to_tsvector('english', c.content), to_tsquery('english', ${tsQuery || "''"})) AS text_score
      FROM content_chunks c
      WHERE
        ${tsQuery ? sql`to_tsvector('english', c.content) @@ to_tsquery('english', ${tsQuery})` : sql`FALSE`}
        ${scopeFilter}
      LIMIT ${topK * 3}
    )
    SELECT
      v.id,
      v.content,
      v.section_title,
      v.page_number,
      v.learning_object_id,
      v.vector_score,
      COALESCE(t.text_score, 0) AS text_score,
      (v.vector_score * ${RAG_VECTOR_WEIGHT} + COALESCE(t.text_score, 0) * ${RAG_BM25_WEIGHT}) AS combined_score
    FROM vector_search v
    LEFT JOIN text_search t ON v.id = t.id
    ORDER BY combined_score DESC
    LIMIT ${topK}
  `);

  const rows = Array.isArray(results) ? results : [];

  return rows.map((r) => ({
    id: r.id,
    content: r.content,
    sectionTitle: r.section_title,
    pageNumber: r.page_number,
    learningObjectId: r.learning_object_id,
    score: Number(r.combined_score),
  }));
}

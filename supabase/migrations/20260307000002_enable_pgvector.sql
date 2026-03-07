-- Enable pgvector extension for embedding similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- HNSW index on content_chunks embeddings for fast similarity search
CREATE INDEX IF NOT EXISTS idx_content_chunks_embedding
  ON content_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- HNSW index on concepts embeddings for deduplication similarity matching
CREATE INDEX IF NOT EXISTS idx_concepts_embedding
  ON concepts
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

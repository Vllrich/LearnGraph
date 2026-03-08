export const CHUNK_MAX_TOKENS = 512;
export const CHUNK_OVERLAP_TOKENS = 100;
export const EMBEDDING_DIMENSIONS = 1536;
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const ANTHROPIC_PRIMARY = "claude-sonnet-4-5-20250514";
export const OPENAI_PRIMARY = "gpt-4.1";
export const OPENAI_FALLBACK = "gpt-4.1-mini";
export const DEFAULT_DAILY_REVIEW_LIMIT = 20;
export const DEFAULT_REVIEW_MIX_RATIO = { review: 0.8, new: 0.2 };
export const RETRIEVABILITY_THRESHOLD = 0.9;
export const RAG_TOP_K = 5;
export const RAG_VECTOR_WEIGHT = 0.7;
export const RAG_BM25_WEIGHT = 0.3;
export const CONCEPT_SIMILARITY_THRESHOLD = 0.92;
export const MAX_FILE_SIZE_MB = 50;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "video/mp4",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

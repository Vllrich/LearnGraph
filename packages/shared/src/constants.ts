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
  "audio/x-m4a",
  "audio/webm",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export const FILE_SOURCE_TYPE_MAP: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "audio/mpeg": "audio",
  "audio/mp4": "audio",
  "audio/wav": "audio",
  "audio/x-m4a": "audio",
  "audio/webm": "audio",
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
};

export const SOURCE_TYPE_LABELS: Record<string, string> = {
  pdf: "PDF Document",
  youtube: "YouTube Video",
  pptx: "PowerPoint",
  docx: "Word Document",
  audio: "Audio",
  url: "Web Article",
  image: "Image",
};

export const SOURCE_TYPE_ACCEPT: Record<string, Record<string, string[]>> = {
  file: {
    "application/pdf": [".pdf"],
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    "audio/mpeg": [".mp3"],
    "audio/mp4": [".m4a"],
    "audio/wav": [".wav"],
    "audio/webm": [".webm"],
    "image/png": [".png"],
    "image/jpeg": [".jpg", ".jpeg"],
    "image/webp": [".webp"],
  },
};

import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { ANTHROPIC_PRIMARY, OPENAI_PRIMARY, OPENAI_FALLBACK, EMBEDDING_MODEL } from "@repo/shared";

const provider = (process.env.LLM_PROVIDER ?? "openai") as "openai" | "anthropic";

const anthropicModel = process.env.ANTHROPIC_MODEL ?? ANTHROPIC_PRIMARY;
const openaiModel = process.env.OPENAI_MODEL ?? OPENAI_PRIMARY;
const openaiModelFallback = process.env.OPENAI_MODEL_FALLBACK ?? OPENAI_FALLBACK;
const embeddingModelId = process.env.OPENAI_EMBEDDING_MODEL ?? EMBEDDING_MODEL;

export const primaryModel =
  provider === "anthropic" ? anthropic(anthropicModel) : openai(openaiModel);

export const fallbackModel = openai(openaiModelFallback);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const embeddingModel = openai.embedding(embeddingModelId) as any;

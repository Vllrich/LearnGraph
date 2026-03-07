import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { PRIMARY_LLM, FALLBACK_LLM, EMBEDDING_MODEL } from "@repo/shared";

export const anthropicModel = anthropic(PRIMARY_LLM);
export const openaiModel = openai(FALLBACK_LLM);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const embeddingModel = openai.embedding(EMBEDDING_MODEL) as any;

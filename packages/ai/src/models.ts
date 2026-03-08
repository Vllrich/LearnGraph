import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { ANTHROPIC_PRIMARY, OPENAI_PRIMARY, OPENAI_FALLBACK, EMBEDDING_MODEL } from "@repo/shared";

const provider = (process.env.LLM_PROVIDER ?? "openai") as "openai" | "anthropic";

export const primaryModel =
  provider === "anthropic" ? anthropic(ANTHROPIC_PRIMARY) : openai(OPENAI_PRIMARY);

export const fallbackModel = openai(OPENAI_FALLBACK);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const embeddingModel = openai.embedding(EMBEDDING_MODEL) as any;

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

/**
 * Variants tuned for structured output (generateObject).
 *
 * OpenAI reasoning models (o-series, gpt-5*) consume tokens on an internal
 * chain-of-thought before emitting output. With a small `maxTokens` budget
 * that can leave zero tokens for the actual JSON, producing an empty string
 * and `finishReason: 'length'`. For schema-constrained block/quiz/suggestion
 * generation we don't need deep reasoning, so we set `reasoningEffort: 'low'`
 * to keep the token budget available for the response itself.
 */
export const structuredPrimaryModel =
  provider === "anthropic"
    ? anthropic(anthropicModel)
    : openai(openaiModel, { reasoningEffort: "low", structuredOutputs: true });

export const structuredFallbackModel = openai(openaiModelFallback, {
  reasoningEffort: "low",
  structuredOutputs: true,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const embeddingModel = openai.embedding(embeddingModelId) as any;

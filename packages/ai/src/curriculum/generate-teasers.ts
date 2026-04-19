import { z } from "zod";
import { streamObject } from "ai";
import { structuredPrimaryModel } from "../models";

/**
 * Schema for a single teaser card shown on the course-generation
 * "curtain" while Phase 1 of /api/learn/start-v2 is in flight. Cards
 * are deliberately tiny: one or two words to hook attention plus a
 * single evocative sentence that teases something the learner will
 * actually encounter in the course.
 */
export const TeaserCardSchema = z.object({
  keyword: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .refine((s) => s.split(/\s+/).filter(Boolean).length <= 3, {
      message: "keyword must be 1-3 words",
    }),
  blurb: z.string().trim().min(1).max(140),
  moduleHint: z.string().trim().max(40).optional(),
});

export type TeaserCard = z.infer<typeof TeaserCardSchema>;

export type TeaserInput = {
  topic: string;
  goalType: string;
  currentLevel: string;
  educationStage?: string;
};

export function buildTeaserPrompt(input: TeaserInput): string {
  const stageLine = input.educationStage
    ? `Audience stage: ${input.educationStage}`
    : "Audience stage: unspecified";

  return [
    `You are creating short "did you know" teaser cards shown while a personalised course is being generated.`,
    ``,
    `Course topic: ${input.topic}`,
    `Goal type: ${input.goalType}`,
    `Learner level: ${input.currentLevel}`,
    stageLine,
    ``,
    `Produce 6–8 cards. Each card teases a compelling concept the learner will encounter in this course.`,
    `Rules:`,
    `- keyword: 1–3 words, Title Case, concrete (no vague phrases like "Key ideas").`,
    `- blurb: ONE sentence, ≤140 characters, evocative, specific to the topic.`,
    `- moduleHint: optional short phrase like "Module 3" or "Later in the course". Omit if unsure.`,
    `- Stay calibrated to the learner level — avoid jargon a beginner couldn't parse.`,
    `- No duplicates. No generic learning-science tips.`,
  ].join("\n");
}

/**
 * Streams teaser cards one at a time from the same model family as the
 * main course generation (see `structuredPrimaryModel`). Callers iterate
 * the generator and render cards as they arrive; a rejected card (e.g.
 * one that violates the schema) is silently skipped rather than
 * terminating the stream.
 *
 * Pass an `AbortSignal` to cancel the upstream LLM call promptly when
 * the consumer navigates away or a timeout fires.
 */
export async function* generateTeaserCardsStream(
  input: TeaserInput,
  options: { signal?: AbortSignal } = {},
): AsyncGenerator<TeaserCard> {
  const { elementStream } = streamObject({
    model: structuredPrimaryModel,
    schema: TeaserCardSchema,
    output: "array",
    prompt: buildTeaserPrompt(input),
    abortSignal: options.signal,
  });

  for await (const partial of elementStream) {
    const result = TeaserCardSchema.safeParse(partial);
    if (result.success) yield result.data;
  }
}

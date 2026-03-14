import { generateObject } from "ai";
import { z } from "zod";
import { primaryModel } from "../models";

const topicHookSchema = z.object({
  hook: z
    .string()
    .describe(
      "A curiosity-sparking sentence (max 20 words) that makes someone want to learn this topic"
    ),
  subtitle: z.string().describe("One-line descriptor (3-6 words)"),
});

export type TopicHook = z.infer<typeof topicHookSchema>;

/**
 * Generate a curiosity hook for a random topic (used for "Surprise me").
 */
export async function generateTopicHook(
  conceptName: string,
  domain?: string | null
): Promise<TopicHook> {
  const { object } = await generateObject({
    model: primaryModel,
    schema: topicHookSchema,
    prompt: `Generate a curiosity-sparking hook for the topic "${conceptName}"${domain ? ` (domain: ${domain})` : ""}.
The hook should make someone immediately want to learn more. Use a surprising fact, counterintuitive insight, or compelling question. Max 20 words.`,
    maxTokens: 150,
  });

  return object;
}

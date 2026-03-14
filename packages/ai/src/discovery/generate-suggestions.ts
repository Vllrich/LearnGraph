import { generateObject } from "ai";
import { z } from "zod";
import { primaryModel } from "../models";
import { buildPersonaBlock } from "../mentor/persona";
import type { LearnerProfile } from "@repo/shared";

const personalizedTopicsSchema = z.object({
  topics: z.array(
    z.object({
      title: z.string().describe("Short topic name (2-4 words)"),
      subtitle: z.string().describe("One-line descriptor (3-6 words)"),
      reason: z
        .string()
        .describe("One sentence explaining why this topic suits the learner"),
    })
  ),
});

const topicHookSchema = z.object({
  hook: z
    .string()
    .describe(
      "A curiosity-sparking sentence (max 20 words) that makes someone want to learn this topic"
    ),
  subtitle: z.string().describe("One-line descriptor (3-6 words)"),
});

export type PersonalizedTopic = z.infer<
  typeof personalizedTopicsSchema
>["topics"][number];

export type TopicHook = z.infer<typeof topicHookSchema>;

/**
 * Generate personalized topic suggestions using the learner's profile,
 * existing courses, and previously dismissed topics as exclusions.
 */
export async function generatePersonalizedTopics(
  profile: LearnerProfile,
  existingGoalTitles: string[],
  dismissedKeys: string[],
  count: number = 8
): Promise<PersonalizedTopic[]> {
  const personaBlock = buildPersonaBlock(profile);

  const exclusionList = [...existingGoalTitles, ...dismissedKeys];
  const exclusionBlock =
    exclusionList.length > 0
      ? `\n<exclusions>\nDo NOT suggest any of these topics (the learner already has them or dismissed them):\n${exclusionList.map((t) => `- ${t}`).join("\n")}\n</exclusions>`
      : "";

  const motivationContext =
    profile.learningMotivations.length > 0
      ? `Learning motivations: ${profile.learningMotivations.join(", ")}.`
      : "";

  const expertiseContext =
    profile.expertiseDomains.length > 0
      ? `Existing expertise: ${profile.expertiseDomains.join(", ")}. Suggest topics that build on or complement these.`
      : "";

  const { object } = await generateObject({
    model: primaryModel,
    schema: personalizedTopicsSchema,
    system: `You are a learning advisor that suggests topics tailored to a specific learner.\n${personaBlock}`,
    prompt: `Suggest exactly ${count} diverse learning topics for this learner.

${motivationContext}
${expertiseContext}
Education stage: ${profile.educationStage}
${exclusionBlock}

Requirements:
- Mix domains: include technical, creative, and interdisciplinary topics
- Each topic should be learnable as a standalone course (not too narrow, not too broad)
- The "reason" field should feel personal — reference the learner's profile, motivations, or expertise
- Prioritize topics that are timely, high-impact, or uniquely interesting for this learner
- Vary difficulty: include both accessible and stretch topics`,
    maxTokens: 800,
  });

  return object.topics.slice(0, count);
}

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

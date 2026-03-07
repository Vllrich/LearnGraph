import { generateObject } from "ai";
import { z } from "zod";
import { anthropicModel } from "../models";
import { countTokens } from "./chunker";

const summarySchema = z.object({
  tldr: z
    .string()
    .describe("2-3 sentence TL;DR summary of the entire document"),
  keyPoints: z
    .array(z.string())
    .min(3)
    .max(10)
    .describe("5-10 key takeaway bullet points"),
  deepSummary: z
    .string()
    .describe("Comprehensive 500-1000 word summary covering all major topics"),
});

export type SummaryResult = z.infer<typeof summarySchema>;

const MAX_CONTEXT_TOKENS = 100_000;

/**
 * Three-tier summarization using Claude.
 * For long docs, uses hierarchical approach (per-section then meta).
 */
export async function summarizeContent(
  text: string,
  title: string,
): Promise<SummaryResult> {
  const tokens = countTokens(text);

  if (tokens <= MAX_CONTEXT_TOKENS) {
    return directSummarize(text, title);
  }

  return hierarchicalSummarize(text, title);
}

async function directSummarize(
  text: string,
  title: string,
): Promise<SummaryResult> {
  const { object } = await generateObject({
    model: anthropicModel,
    schema: summarySchema,
    prompt: buildPrompt(text, title),
    temperature: 0.3,
  });

  return object;
}

async function hierarchicalSummarize(
  text: string,
  title: string,
): Promise<SummaryResult> {
  const sections = text.split(/\n{3,}/);
  const sectionSize = Math.ceil(MAX_CONTEXT_TOKENS * 0.8);
  const sectionBatches: string[] = [];
  let current = "";

  for (const section of sections) {
    if (countTokens(current + "\n\n" + section) > sectionSize && current) {
      sectionBatches.push(current);
      current = section;
    } else {
      current = current ? current + "\n\n" + section : section;
    }
  }
  if (current) sectionBatches.push(current);

  const sectionSchema = z.object({
    summary: z.string(),
    keyPoints: z.array(z.string()).max(5),
  });

  const sectionSummaries: z.infer<typeof sectionSchema>[] = [];
  for (let i = 0; i < sectionBatches.length; i++) {
    const { object } = await generateObject({
      model: anthropicModel,
      schema: sectionSchema,
      prompt: `Summarize this section (part ${i + 1} of ${sectionBatches.length}) of "${title}":\n\n${sectionBatches[i]}`,
      temperature: 0.3,
    });
    sectionSummaries.push(object);
  }

  const combinedText = sectionSummaries
    .map((s, i) => `Part ${i + 1}:\n${s.summary}\nKey points: ${s.keyPoints.join("; ")}`)
    .join("\n\n");

  return directSummarize(combinedText, title + " (meta-summary)");
}

function buildPrompt(text: string, title: string): string {
  return `You are summarizing a learning document titled "${title}".

Generate three tiers of summary:
1. **tldr**: A 2-3 sentence overview that captures the essence
2. **keyPoints**: 5-10 bullet points covering the most important concepts and takeaways
3. **deepSummary**: A comprehensive 500-1000 word summary covering all major topics, definitions, and relationships between concepts

Ground every claim in the source text. Do not add information not present in the document.

Source document:
${text}`;
}

import { z } from "zod";

export const conceptBlockSchema = z.object({
  text: z.string().describe("Main explanation text (markdown). 2-6 paragraphs."),
  keyTerms: z.array(z.object({
    term: z.string(),
    definition: z.string(),
  })).describe("Key terms introduced in this block"),
  mermaidDiagram: z.string().nullable().describe("Mermaid diagram source, or null if not needed"),
});

export const checkpointBlockSchema = z.object({
  questions: z.array(z.object({
    type: z.enum(["mcq", "short_answer"]),
    question: z.string(),
    options: z.array(z.string()).nullable().describe("MCQ options (3-5), or null for short_answer"),
    correctIndex: z.number().nullable().describe("0-based index of correct MCQ option, or null for short_answer"),
    correctAnswer: z.string().nullable().describe("Expected short answer, or null for MCQ"),
    explanation: z.string().describe("Why this answer is correct"),
    bloomLevel: z.enum(["remember", "understand", "apply", "analyze", "evaluate", "create"]),
  })).min(1).max(3),
});

export const practiceBlockSchema = z.object({
  exercise: z.string().describe("Exercise prompt (markdown)"),
  hints: z.array(z.string()).describe("Progressive hints (first = gentle nudge, last = almost the answer)"),
  solutionSteps: z.array(z.string()).describe("Step-by-step solution"),
  rubric: z.array(z.object({
    criterion: z.string(),
    weight: z.number().min(0).max(100),
  })).describe("Grading rubric for AI evaluation"),
});

export const reflectionBlockSchema = z.object({
  prompt: z.string().describe("Reflection prompt for the learner"),
  guidingQuestions: z.array(z.string()).min(1).max(3).describe("Sub-questions to guide reflection"),
  sampleResponse: z.string().describe("Example of a strong response"),
});

export const scenarioBlockSchema = z.object({
  narrative: z.string().describe("Opening scenario description (markdown)"),
  decisions: z.array(z.object({
    prompt: z.string(),
    options: z.array(z.object({
      label: z.string(),
      outcome: z.string(),
      isOptimal: z.boolean(),
    })).min(2).max(4),
  })).min(1).max(3),
  debrief: z.string().describe("Summary of lessons learned from the scenario"),
});

export const workedExampleBlockSchema = z.object({
  problemStatement: z.string().describe("The problem to solve"),
  steps: z.array(z.object({
    title: z.string(),
    explanation: z.string(),
    keyInsight: z.string().nullable(),
  })).min(2).max(8),
  finalAnswer: z.string(),
  commonMistakes: z.array(z.string()).describe("Common mistakes to avoid"),
});

export const mentorBlockSchema = z.object({
  openingPrompt: z.string().describe("The mentor's opening question or challenge"),
  technique: z.enum(["socratic", "challenge", "connection", "metacognitive"]),
  followUpPrompts: z.array(z.string()).min(1).max(3).describe("Follow-up probes based on likely responses"),
  targetInsight: z.string().describe("The insight the mentor is guiding toward"),
});

export type ConceptBlockContent = z.infer<typeof conceptBlockSchema>;
export type CheckpointBlockContent = z.infer<typeof checkpointBlockSchema>;
export type PracticeBlockContent = z.infer<typeof practiceBlockSchema>;
export type ReflectionBlockContent = z.infer<typeof reflectionBlockSchema>;
export type ScenarioBlockContent = z.infer<typeof scenarioBlockSchema>;
export type WorkedExampleBlockContent = z.infer<typeof workedExampleBlockSchema>;
export type MentorBlockContent = z.infer<typeof mentorBlockSchema>;

export type BlockContent =
  | ConceptBlockContent
  | CheckpointBlockContent
  | PracticeBlockContent
  | ReflectionBlockContent
  | ScenarioBlockContent
  | WorkedExampleBlockContent
  | MentorBlockContent;

import { generateObject } from "ai";
import { z } from "zod";
import { primaryModel } from "../models";
import { db, learningGoals, curriculumItems } from "@repo/db";
import type { GoalType, LearnerLevel } from "@repo/shared";

const curriculumSchema = z.object({
  concepts: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      estimatedMinutes: z.number().min(2).max(30),
      prerequisites: z.array(z.string()),
    })
  ),
});

export type CurriculumInput = {
  topic: string;
  goalType: GoalType;
  currentLevel: LearnerLevel;
  userId: string;
  timeBudgetMinutes?: number;
};

export async function generateCurriculum(input: CurriculumInput) {
  const { topic, goalType, currentLevel, userId, timeBudgetMinutes } = input;

  const levelContext = {
    beginner: "The learner is completely new to this topic. Start from absolute basics.",
    some_knowledge:
      "The learner has some familiarity. Skip the very basics, start from intermediate fundamentals.",
    experienced: "The learner is experienced. Focus on advanced topics, nuances, and edge cases.",
  }[currentLevel];

  const goalContext = {
    exam_prep:
      "Focus on testable knowledge: key facts, common question patterns, and tricky edge cases. Prioritize retrieval practice and interleaving.",
    skill_building:
      "Focus on practical skills and real-world application. Include hands-on exercises and project-oriented concepts.",
    course_supplement:
      "Follow a logical textbook-style progression. Focus on concept reinforcement and filling knowledge gaps.",
    exploration:
      "Follow the learner's curiosity. Cover interesting and surprising aspects. Keep it engaging and broad.",
  }[goalType];

  const { object: curriculum } = await generateObject({
    model: primaryModel,
    schema: curriculumSchema,
    prompt: `Generate a structured learning curriculum for the topic: "${topic}".

${levelContext}
${goalContext}

Generate 8-15 concepts in optimal learning order (prerequisites first). Each concept should be a single teachable unit that takes 5-15 minutes.
${timeBudgetMinutes ? `The learner has about ${timeBudgetMinutes} minutes per day.` : ""}

Return concepts in dependency order — a concept's prerequisites must appear earlier in the list.`,
    temperature: 0.5,
  });

  const [goal] = await db
    .insert(learningGoals)
    .values({
      userId,
      title: topic,
      description: `AI-generated curriculum for: ${topic}`,
      goalType,
      currentLevel,
      timeBudgetMinutes: timeBudgetMinutes ?? null,
      status: "active",
    })
    .returning();

  const items = await db
    .insert(curriculumItems)
    .values(
      curriculum.concepts.map((concept, i) => ({
        goalId: goal.id,
        sequenceOrder: i,
        title: concept.title,
        description: concept.description,
        estimatedMinutes: concept.estimatedMinutes,
        learningMethod: i === 0 ? "guided_lesson" : null,
        aiGenerated: true,
        status: "pending" as const,
      }))
    )
    .returning();

  return { goal, items };
}

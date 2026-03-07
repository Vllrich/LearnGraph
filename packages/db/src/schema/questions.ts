import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { learningObjects } from "./learning-objects";

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    learningObjectId: uuid("learning_object_id")
      .references(() => learningObjects.id, { onDelete: "cascade" })
      .notNull(),
    questionType: text("question_type").notNull(),
    questionText: text("question_text").notNull(),
    options: jsonb("options"),
    correctAnswer: text("correct_answer"),
    explanation: text("explanation"),
    difficulty: integer("difficulty").default(3),
    conceptIds: uuid("concept_ids").array().default([]),
    groundingChunks: uuid("grounding_chunks").array().default([]),
    qualityScore: real("quality_score").default(1.0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    check("difficulty_check", sql`${table.difficulty} BETWEEN 1 AND 5`),
  ]
);

export const userAnswers = pgTable("user_answers", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  questionId: uuid("question_id")
    .references(() => questions.id, { onDelete: "cascade" })
    .notNull(),
  answerText: text("answer_text"),
  isCorrect: boolean("is_correct"),
  feedback: text("feedback"),
  timeTakenMs: integer("time_taken_ms"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
export type UserAnswer = typeof userAnswers.$inferSelect;
export type NewUserAnswer = typeof userAnswers.$inferInsert;

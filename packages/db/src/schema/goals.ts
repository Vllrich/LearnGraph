import { pgTable, uuid, text, integer, date, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const learningGoals = pgTable("learning_goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  description: text("description"),
  targetDate: date("target_date"),
  status: text("status").default("active"),
  targetConcepts: uuid("target_concepts").array().default([]),
  goalType: text("goal_type"),
  currentLevel: text("current_level"),
  timeBudgetMinutes: integer("time_budget_minutes"),
  examDate: timestamp("exam_date", { withTimezone: true }),
  coverImageUrl: text("cover_image_url"),
  educationStage: text("education_stage"),
  sessionMinutes: integer("session_minutes"),
  daysPerWeek: integer("days_per_week"),
  contextNote: text("context_note"),
  learningMode: text("learning_mode").default("understand_first"),
  schemaVersion: integer("schema_version").default(1),
  // Progressive-generation lifecycle. See docs/modular-courses.md for the
  // two-phase flow: 'generating' while Phase 2 (after()) is materializing the
  // course, 'ready' once done, 'failed' with `generationError` populated if
  // Phase 2 crashed. Default 'ready' so existing rows backfill cleanly.
  // A CHECK constraint in 0002_goal_generation_status.sql pins the enum.
  generationStatus: text("generation_status").notNull().default("ready"),
  generationStartedAt: timestamp("generation_started_at", { withTimezone: true }),
  generationError: text("generation_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type LearningGoal = typeof learningGoals.$inferSelect;
export type NewLearningGoal = typeof learningGoals.$inferInsert;

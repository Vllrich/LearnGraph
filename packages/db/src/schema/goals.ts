import { pgTable, uuid, text, integer, boolean, date, timestamp, index, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users";
import { learningObjects } from "./learning-objects";

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
  focusMode: text("focus_mode"),
  methodPreferences: jsonb("method_preferences"),
  contextNote: text("context_note"),
  learningMode: text("learning_mode").default("understand_first"),
  schemaVersion: integer("schema_version").default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const curriculumItems = pgTable(
  "curriculum_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    goalId: uuid("goal_id")
      .references(() => learningGoals.id, { onDelete: "cascade" })
      .notNull(),
    sequenceOrder: integer("sequence_order").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    conceptIds: uuid("concept_ids").array().default([]),
    learningObjectId: uuid("learning_object_id").references(() => learningObjects.id),
    estimatedMinutes: integer("estimated_minutes"),
    status: text("status").default("pending"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    learningMethod: text("learning_method"),
    aiGenerated: boolean("ai_generated").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("idx_curriculum_goal").on(table.goalId, table.sequenceOrder)]
);

export type LearningGoal = typeof learningGoals.$inferSelect;
export type NewLearningGoal = typeof learningGoals.$inferInsert;
export type CurriculumItem = typeof curriculumItems.$inferSelect;
export type NewCurriculumItem = typeof curriculumItems.$inferInsert;

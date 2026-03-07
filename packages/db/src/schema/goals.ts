import {
  pgTable,
  uuid,
  text,
  integer,
  date,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
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
    learningObjectId: uuid("learning_object_id").references(
      () => learningObjects.id
    ),
    estimatedMinutes: integer("estimated_minutes"),
    status: text("status").default("pending"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_curriculum_goal").on(table.goalId, table.sequenceOrder),
  ]
);

export type LearningGoal = typeof learningGoals.$inferSelect;
export type NewLearningGoal = typeof learningGoals.$inferInsert;
export type CurriculumItem = typeof curriculumItems.$inferSelect;
export type NewCurriculumItem = typeof curriculumItems.$inferInsert;

import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { learningGoals } from "./goals";

export const courseModules = pgTable(
  "course_modules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    goalId: uuid("goal_id")
      .references(() => learningGoals.id, { onDelete: "cascade" })
      .notNull(),
    sequenceOrder: integer("sequence_order").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    moduleType: text("module_type").notNull().default("mandatory"),
    conceptIds: uuid("concept_ids").array().default([]),
    unlockRule: jsonb("unlock_rule"),
    estimatedMinutes: integer("estimated_minutes"),
    status: text("status").default("locked"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_course_modules_goal").on(table.goalId, table.sequenceOrder),
    check(
      "module_type_check",
      sql`${table.moduleType} IN ('mandatory','remedial','advanced','enrichment')`
    ),
    check(
      "module_status_check",
      sql`${table.status} IN ('locked','available','in_progress','completed','skipped')`
    ),
  ]
);

export const courseLessons = pgTable(
  "course_lessons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moduleId: uuid("module_id")
      .references(() => courseModules.id, { onDelete: "cascade" })
      .notNull(),
    sequenceOrder: integer("sequence_order").notNull(),
    title: text("title").notNull(),
    lessonType: text("lesson_type").notNull().default("standard"),
    estimatedMinutes: integer("estimated_minutes"),
    status: text("status").default("pending"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_course_lessons_module").on(table.moduleId, table.sequenceOrder),
    check(
      "lesson_type_check",
      sql`${table.lessonType} IN ('standard','workshop','lab','case_study','revision','capstone')`
    ),
    check(
      "lesson_status_check",
      sql`${table.status} IN ('pending','in_progress','completed','skipped')`
    ),
  ]
);

export const lessonBlocks = pgTable(
  "lesson_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonId: uuid("lesson_id")
      .references(() => courseLessons.id, { onDelete: "cascade" })
      .notNull(),
    sequenceOrder: integer("sequence_order").notNull(),
    blockType: text("block_type").notNull(),
    conceptIds: uuid("concept_ids").array().default([]),
    contentChunkIds: uuid("content_chunk_ids").array().default([]),
    bloomLevel: text("bloom_level"),
    generatedContent: jsonb("generated_content").notNull().default({}),
    interactionLog: jsonb("interaction_log").default([]),
    status: text("status").default("pending"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_lesson_blocks_lesson").on(table.lessonId, table.sequenceOrder),
    check(
      "block_type_check",
      sql`${table.blockType} IN ('concept','worked_example','checkpoint','practice','reflection','scenario','mentor')`
    ),
    check(
      "block_bloom_check",
      sql`${table.bloomLevel} IS NULL OR ${table.bloomLevel} IN ('remember','understand','apply','analyze','evaluate','create')`
    ),
    check(
      "block_status_check",
      sql`${table.status} IN ('pending','in_progress','completed','skipped')`
    ),
  ]
);

export type CourseModule = typeof courseModules.$inferSelect;
export type NewCourseModule = typeof courseModules.$inferInsert;
export type CourseLesson = typeof courseLessons.$inferSelect;
export type NewCourseLesson = typeof courseLessons.$inferInsert;
export type LessonBlock = typeof lessonBlocks.$inferSelect;
export type NewLessonBlock = typeof lessonBlocks.$inferInsert;

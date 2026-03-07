import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  timestamp,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { concepts } from "./concepts";

export const userConceptState = pgTable(
  "user_concept_state",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    conceptId: uuid("concept_id")
      .references(() => concepts.id, { onDelete: "cascade" })
      .notNull(),
    masteryLevel: integer("mastery_level").default(0),

    fsrsStability: real("fsrs_stability").default(0),
    fsrsDifficulty: real("fsrs_difficulty").default(5.0),
    fsrsElapsedDays: real("fsrs_elapsed_days").default(0),
    fsrsScheduledDays: real("fsrs_scheduled_days").default(0),
    fsrsRetrievability: real("fsrs_retrievability").default(0),
    fsrsState: text("fsrs_state").default("new"),
    fsrsReps: integer("fsrs_reps").default(0),
    fsrsLapses: integer("fsrs_lapses").default(0),
    lastReviewAt: timestamp("last_review_at", { withTimezone: true }),
    nextReviewAt: timestamp("next_review_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_user_concept_unique").on(table.userId, table.conceptId),
    index("idx_user_concept_review").on(table.userId, table.nextReviewAt),
    check(
      "mastery_level_check",
      sql`${table.masteryLevel} BETWEEN 0 AND 5`
    ),
  ]
);

export const reviewLog = pgTable(
  "review_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    conceptId: uuid("concept_id")
      .references(() => concepts.id, { onDelete: "cascade" })
      .notNull(),
    rating: integer("rating").notNull(),
    reviewType: text("review_type").notNull(),
    questionId: uuid("question_id"),
    responseTimeMs: integer("response_time_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_review_log_user").on(table.userId, table.createdAt),
    check("rating_check", sql`${table.rating} BETWEEN 1 AND 4`),
  ]
);

export type UserConceptState = typeof userConceptState.$inferSelect;
export type NewUserConceptState = typeof userConceptState.$inferInsert;
export type ReviewLog = typeof reviewLog.$inferSelect;
export type NewReviewLog = typeof reviewLog.$inferInsert;

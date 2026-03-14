import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  timestamp,
  jsonb,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";

export const learnerProfiles = pgTable(
  "learner_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),

    // Declared — user sets these explicitly
    educationStage: text("education_stage").notNull().default("self_learner"),
    nativeLanguage: text("native_language").notNull().default("en"),
    contentLanguage: text("content_language").notNull().default("en"),
    communicationStyle: text("communication_style").notNull().default("balanced"),
    explanationDepth: text("explanation_depth").notNull().default("standard"),
    mentorTone: text("mentor_tone").notNull().default("encouraging"),
    expertiseDomains: text("expertise_domains").array().default([]),
    learningMotivations: text("learning_motivations").array().default([]),
    accessibilityNeeds: jsonb("accessibility_needs").default({}),

    // Inferred — system calibrates over time
    inferredReadingLevel: real("inferred_reading_level"),
    inferredOptimalSessionMin: integer("inferred_optimal_session_min"),
    inferredBloomCeiling: text("inferred_bloom_ceiling"),
    inferredPace: text("inferred_pace"),
    calibrationConfidence: real("calibration_confidence").default(0),
    lastCalibratedAt: timestamp("last_calibrated_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    check(
      "communication_style_check",
      sql`${table.communicationStyle} IN ('casual', 'balanced', 'formal')`
    ),
    check(
      "explanation_depth_check",
      sql`${table.explanationDepth} IN ('concise', 'standard', 'thorough')`
    ),
    check(
      "mentor_tone_check",
      sql`${table.mentorTone} IN ('encouraging', 'neutral', 'challenging')`
    ),
    check(
      "education_stage_check",
      sql`${table.educationStage} IN ('elementary', 'high_school', 'university', 'professional', 'self_learner')`
    ),
    check(
      "inferred_pace_check",
      sql`${table.inferredPace} IS NULL OR ${table.inferredPace} IN ('slow', 'medium', 'fast')`
    ),
  ]
);

export type LearnerProfileRow = typeof learnerProfiles.$inferSelect;
export type NewLearnerProfileRow = typeof learnerProfiles.$inferInsert;

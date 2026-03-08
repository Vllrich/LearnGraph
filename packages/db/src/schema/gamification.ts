import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
  jsonb,
  real,
  date,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { concepts } from "./concepts";

export const userAchievements = pgTable(
  "user_achievements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    achievementKey: text("achievement_key").notNull(),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }).defaultNow(),
    metadata: jsonb("metadata").default({}),
  },
  (table) => [
    uniqueIndex("idx_user_achievement_unique").on(table.userId, table.achievementKey),
    index("idx_user_achievements_user").on(table.userId),
  ]
);

export const userStreaks = pgTable(
  "user_streaks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    currentStreak: integer("current_streak").default(0),
    longestStreak: integer("longest_streak").default(0),
    lastActivityDate: date("last_activity_date"),
    freezesUsed: integer("freezes_used_this_week").default(0),
    freezeWeekStart: date("freeze_week_start"),
    totalXp: integer("total_xp").default(0),
    weeklyReviewGoal: integer("weekly_review_goal").default(50),
    weeklyReviewsDone: integer("weekly_reviews_done").default(0),
    weekStart: date("week_start"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [uniqueIndex("idx_user_streaks_user").on(table.userId)]
);

export const userWeeklySnapshots = pgTable(
  "user_weekly_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    weekStart: date("week_start").notNull(),
    conceptsMastered: integer("concepts_mastered").default(0),
    conceptsStruggled: integer("concepts_struggled").default(0),
    reviewsCompleted: integer("reviews_completed").default(0),
    averageAccuracy: real("average_accuracy"),
    totalStudyTimeMs: integer("total_study_time_ms").default(0),
    streakDays: integer("streak_days").default(0),
    xpEarned: integer("xp_earned").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_weekly_snapshot_unique").on(table.userId, table.weekStart),
    index("idx_weekly_snapshot_user").on(table.userId),
  ]
);

export const conceptSnapshots = pgTable(
  "concept_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    conceptId: uuid("concept_id")
      .references(() => concepts.id, { onDelete: "cascade" })
      .notNull(),
    snapshotDate: date("snapshot_date").notNull(),
    masteryLevel: integer("mastery_level").default(0),
    retrievability: real("retrievability"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("idx_concept_snapshot_user_date").on(table.userId, table.snapshotDate)]
);

export const sharedCurriculums = pgTable("shared_curriculums", {
  id: uuid("id").primaryKey().defaultRandom(),
  goalId: uuid("goal_id").notNull(),
  shareToken: text("share_token").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  items: jsonb("items").notNull(),
  createdByUserId: uuid("created_by_user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  viewCount: integer("view_count").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type UserAchievement = typeof userAchievements.$inferSelect;
export type UserStreak = typeof userStreaks.$inferSelect;
export type UserWeeklySnapshot = typeof userWeeklySnapshots.$inferSelect;
export type ConceptSnapshot = typeof conceptSnapshots.$inferSelect;
export type SharedCurriculum = typeof sharedCurriculums.$inferSelect;

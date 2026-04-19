-- Progressive course generation: three new columns on learning_goals and a
-- CHECK constraint pinning the status enum. See docs/modular-courses.md.

ALTER TABLE "learning_goals"
  ADD COLUMN IF NOT EXISTS "generation_status" text NOT NULL DEFAULT 'ready';
--> statement-breakpoint
ALTER TABLE "learning_goals"
  ADD COLUMN IF NOT EXISTS "generation_started_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "learning_goals"
  ADD COLUMN IF NOT EXISTS "generation_error" text;
--> statement-breakpoint

-- Pin the status enum at the DB layer so a typo in application code
-- ("generting") fails loudly instead of silently poisoning UI branching.
ALTER TABLE "learning_goals" ADD CONSTRAINT "learning_goals_generation_status_check"
  CHECK ("generation_status" IN ('generating', 'ready', 'failed'));
--> statement-breakpoint

-- Partial indexes: only the minority of rows in non-'ready' states ever need
-- to be looked up by these predicates (UI polling + a future stuck-job cron).
CREATE INDEX IF NOT EXISTS "idx_learning_goals_generation_status"
  ON "learning_goals" ("generation_status")
  WHERE "generation_status" <> 'ready';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_learning_goals_generation_started_at"
  ON "learning_goals" ("generation_started_at")
  WHERE "generation_status" = 'generating';

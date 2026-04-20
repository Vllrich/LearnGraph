-- Per-module generation tracking.
--
-- Motivation: the course-level `learning_goals.generation_status` (0002) only
-- tells us whether Phase 2 as a whole is running / ready / failed. To support
-- progressive UI (skeletons per module, "module N ready" push events, per-module
-- retry) we need an independent lifecycle per `course_modules` row.
--
-- These columns intentionally mirror the shape of OpenAI's background Responses
-- API (see docs/plans/progressive-course-generation.md) so a future swap from
-- the current `after()`-driven flow to a real background queue (BullMQ, or
-- OpenAI background mode directly) is a storage-compatible change rather than
-- a schema migration.
--
-- All columns are nullable + have sensible defaults so rows backfilled from
-- courses generated under the old flow remain valid.

ALTER TABLE "course_modules"
  ADD COLUMN IF NOT EXISTS "generation_status" text NOT NULL DEFAULT 'ready';
--> statement-breakpoint
ALTER TABLE "course_modules"
  ADD COLUMN IF NOT EXISTS "generation_attempt" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "course_modules"
  ADD COLUMN IF NOT EXISTS "generation_response_id" text;
--> statement-breakpoint
ALTER TABLE "course_modules"
  ADD COLUMN IF NOT EXISTS "generation_error" text;
--> statement-breakpoint
ALTER TABLE "course_modules"
  ADD COLUMN IF NOT EXISTS "generation_started_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "course_modules"
  ADD COLUMN IF NOT EXISTS "generation_completed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "course_modules"
  ADD COLUMN IF NOT EXISTS "generation_prompt_tokens" integer;
--> statement-breakpoint
ALTER TABLE "course_modules"
  ADD COLUMN IF NOT EXISTS "generation_completion_tokens" integer;
--> statement-breakpoint
ALTER TABLE "course_modules"
  ADD COLUMN IF NOT EXISTS "generation_total_latency_ms" integer;
--> statement-breakpoint
ALTER TABLE "course_modules"
  ADD COLUMN IF NOT EXISTS "generation_degraded_mode" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "course_modules"
  ADD COLUMN IF NOT EXISTS "generation_schema_version" integer NOT NULL DEFAULT 1;
--> statement-breakpoint

-- Pin the lifecycle enum at the DB layer so a typo in application code fails
-- loudly instead of silently poisoning the UI state machine. Note `ready` is
-- the default to keep pre-0003 rows valid — they *are* ready.
ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_generation_status_check"
  CHECK ("generation_status" IN ('pending', 'generating', 'ready', 'failed'));
--> statement-breakpoint

-- Fast lookup for the SSE endpoint's poll cycle: "give me all modules for this
-- goal that haven't reached a terminal state." Partial index so the majority
-- of rows (ready) don't bloat it.
CREATE INDEX IF NOT EXISTS "idx_course_modules_generation_pending"
  ON "course_modules" ("goal_id", "sequence_order")
  WHERE "generation_status" IN ('pending', 'generating', 'failed');
--> statement-breakpoint

-- Cron sweeper / stuck-job detector lookup: "modules that started but never
-- finished." Partial so only in-flight rows are indexed.
CREATE INDEX IF NOT EXISTS "idx_course_modules_generation_started_at"
  ON "course_modules" ("generation_started_at")
  WHERE "generation_status" = 'generating';

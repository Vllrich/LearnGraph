ALTER TABLE "learning_goals" ADD COLUMN "education_stage" text;--> statement-breakpoint
ALTER TABLE "learning_goals" ADD COLUMN "session_minutes" integer;--> statement-breakpoint
ALTER TABLE "learning_goals" ADD COLUMN "days_per_week" integer;--> statement-breakpoint
ALTER TABLE "learning_goals" ADD COLUMN "focus_mode" text;--> statement-breakpoint
ALTER TABLE "learning_goals" ADD COLUMN "method_preferences" jsonb;--> statement-breakpoint
ALTER TABLE "learning_goals" ADD COLUMN "context_note" text;
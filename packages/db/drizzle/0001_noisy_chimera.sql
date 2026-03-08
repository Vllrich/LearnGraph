CREATE TABLE "concept_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"concept_id" uuid NOT NULL,
	"snapshot_date" date NOT NULL,
	"mastery_level" integer DEFAULT 0,
	"retrievability" real,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shared_curriculums" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"share_token" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"items" jsonb NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"view_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "shared_curriculums_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"achievement_key" text NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now(),
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "user_streaks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"current_streak" integer DEFAULT 0,
	"longest_streak" integer DEFAULT 0,
	"last_activity_date" date,
	"freezes_used_this_week" integer DEFAULT 0,
	"freeze_week_start" date,
	"total_xp" integer DEFAULT 0,
	"weekly_review_goal" integer DEFAULT 50,
	"weekly_reviews_done" integer DEFAULT 0,
	"week_start" date,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_weekly_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"concepts_mastered" integer DEFAULT 0,
	"concepts_struggled" integer DEFAULT 0,
	"reviews_completed" integer DEFAULT 0,
	"average_accuracy" real,
	"total_study_time_ms" integer DEFAULT 0,
	"streak_days" integer DEFAULT 0,
	"xp_earned" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "concept_snapshots" ADD CONSTRAINT "concept_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_snapshots" ADD CONSTRAINT "concept_snapshots_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_curriculums" ADD CONSTRAINT "shared_curriculums_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_streaks" ADD CONSTRAINT "user_streaks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_weekly_snapshots" ADD CONSTRAINT "user_weekly_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_concept_snapshot_user_date" ON "concept_snapshots" USING btree ("user_id","snapshot_date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_achievement_unique" ON "user_achievements" USING btree ("user_id","achievement_key");--> statement-breakpoint
CREATE INDEX "idx_user_achievements_user" ON "user_achievements" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_streaks_user" ON "user_streaks" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_weekly_snapshot_unique" ON "user_weekly_snapshots" USING btree ("user_id","week_start");--> statement-breakpoint
CREATE INDEX "idx_weekly_snapshot_user" ON "user_weekly_snapshots" USING btree ("user_id");
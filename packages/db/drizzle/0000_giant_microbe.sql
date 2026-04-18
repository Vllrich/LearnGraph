CREATE TABLE "concept_chunk_links" (
	"concept_id" uuid NOT NULL,
	"chunk_id" uuid NOT NULL,
	"relevance_score" real DEFAULT 1,
	CONSTRAINT "concept_chunk_links_concept_id_chunk_id_pk" PRIMARY KEY("concept_id","chunk_id")
);
--> statement-breakpoint
CREATE TABLE "concept_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"edge_type" text NOT NULL,
	"confidence" real DEFAULT 1,
	"source_origin" text DEFAULT 'ai',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "concepts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_name" text NOT NULL,
	"display_name" text NOT NULL,
	"definition" text,
	"aliases" text[] DEFAULT '{}',
	"difficulty_level" integer DEFAULT 3,
	"bloom_level" text DEFAULT 'understand',
	"domain" text,
	"embedding" vector(1536),
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "difficulty_level_check" CHECK ("concepts"."difficulty_level" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "course_lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" uuid NOT NULL,
	"sequence_order" integer NOT NULL,
	"title" text NOT NULL,
	"lesson_type" text DEFAULT 'standard' NOT NULL,
	"estimated_minutes" integer,
	"status" text DEFAULT 'pending',
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "lesson_type_check" CHECK ("course_lessons"."lesson_type" IN ('standard','workshop','lab','case_study','revision','capstone')),
	CONSTRAINT "lesson_status_check" CHECK ("course_lessons"."status" IN ('pending','in_progress','completed','skipped'))
);
--> statement-breakpoint
CREATE TABLE "course_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"sequence_order" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"module_type" text DEFAULT 'mandatory' NOT NULL,
	"concept_ids" uuid[] DEFAULT '{}',
	"unlock_rule" jsonb,
	"estimated_minutes" integer,
	"status" text DEFAULT 'locked',
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "module_type_check" CHECK ("course_modules"."module_type" IN ('mandatory','remedial','advanced','enrichment')),
	CONSTRAINT "module_status_check" CHECK ("course_modules"."status" IN ('locked','available','in_progress','completed','skipped'))
);
--> statement-breakpoint
CREATE TABLE "lesson_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"sequence_order" integer NOT NULL,
	"block_type" text NOT NULL,
	"concept_ids" uuid[] DEFAULT '{}',
	"content_chunk_ids" uuid[] DEFAULT '{}',
	"bloom_level" text,
	"generated_content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"interaction_log" jsonb DEFAULT '[]'::jsonb,
	"status" text DEFAULT 'pending',
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "block_type_check" CHECK ("lesson_blocks"."block_type" IN ('concept','worked_example','checkpoint','practice','reflection','scenario','mentor')),
	CONSTRAINT "block_bloom_check" CHECK ("lesson_blocks"."bloom_level" IS NULL OR "lesson_blocks"."bloom_level" IN ('remember','understand','apply','analyze','evaluate','create')),
	CONSTRAINT "block_status_check" CHECK ("lesson_blocks"."status" IN ('pending','in_progress','completed','skipped'))
);
--> statement-breakpoint
CREATE TABLE "suggestion_dismissals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"suggestion_type" text NOT NULL,
	"suggestion_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
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
CREATE TABLE "learning_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"target_date" date,
	"status" text DEFAULT 'active',
	"target_concepts" uuid[] DEFAULT '{}',
	"goal_type" text,
	"current_level" text,
	"time_budget_minutes" integer,
	"exam_date" timestamp with time zone,
	"cover_image_url" text,
	"education_stage" text,
	"session_minutes" integer,
	"days_per_week" integer,
	"context_note" text,
	"learning_mode" text DEFAULT 'understand_first',
	"schema_version" integer DEFAULT 1,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"timezone" text DEFAULT 'UTC',
	"onboarding" jsonb DEFAULT '{"completed":false}'::jsonb,
	"preferences" jsonb DEFAULT '{}'::jsonb,
	"subscription" text DEFAULT 'free',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "subscription_check" CHECK ("users"."subscription" IN ('free', 'pro', 'team'))
);
--> statement-breakpoint
CREATE TABLE "content_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learning_object_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"section_title" text,
	"page_number" integer,
	"token_count" integer,
	"embedding" vector(1536),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "learning_objects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"source_type" text NOT NULL,
	"source_url" text,
	"file_path" text,
	"raw_text" text,
	"status" text DEFAULT 'processing' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"summary_tldr" text,
	"summary_key_points" text,
	"summary_deep" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "review_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"concept_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"review_type" text NOT NULL,
	"question_id" uuid,
	"response_time_ms" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "rating_check" CHECK ("review_log"."rating" BETWEEN 1 AND 4)
);
--> statement-breakpoint
CREATE TABLE "user_concept_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"concept_id" uuid NOT NULL,
	"mastery_level" integer DEFAULT 0,
	"fsrs_stability" real DEFAULT 0,
	"fsrs_difficulty" real DEFAULT 5,
	"fsrs_elapsed_days" real DEFAULT 0,
	"fsrs_scheduled_days" real DEFAULT 0,
	"fsrs_retrievability" real DEFAULT 0,
	"fsrs_state" text DEFAULT 'new',
	"fsrs_reps" integer DEFAULT 0,
	"fsrs_lapses" integer DEFAULT 0,
	"last_review_at" timestamp with time zone,
	"next_review_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "mastery_level_check" CHECK ("user_concept_state"."mastery_level" BETWEEN 0 AND 5)
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learning_object_id" uuid NOT NULL,
	"question_type" text NOT NULL,
	"question_text" text NOT NULL,
	"options" jsonb,
	"correct_answer" text,
	"explanation" text,
	"difficulty" integer DEFAULT 3,
	"concept_ids" uuid[] DEFAULT '{}',
	"grounding_chunks" uuid[] DEFAULT '{}',
	"quality_score" real DEFAULT 1,
	"thumbs_up" integer DEFAULT 0,
	"thumbs_down" integer DEFAULT 0,
	"is_excluded" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "difficulty_check" CHECK ("questions"."difficulty" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "user_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"answer_text" text,
	"is_correct" boolean,
	"feedback" text,
	"time_taken_ms" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mentor_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"learning_object_id" uuid,
	"title" text,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"teaching_objective" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "learner_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"education_stage" text DEFAULT 'self_learner' NOT NULL,
	"native_language" text DEFAULT 'en' NOT NULL,
	"content_language" text DEFAULT 'en' NOT NULL,
	"communication_style" text DEFAULT 'balanced' NOT NULL,
	"explanation_depth" text DEFAULT 'standard' NOT NULL,
	"mentor_tone" text DEFAULT 'encouraging' NOT NULL,
	"expertise_domains" text[] DEFAULT '{}',
	"learning_motivations" text[] DEFAULT '{}',
	"accessibility_needs" jsonb DEFAULT '{}'::jsonb,
	"inferred_reading_level" real,
	"inferred_optimal_session_min" integer,
	"inferred_bloom_ceiling" text,
	"inferred_pace" text,
	"calibration_confidence" real DEFAULT 0,
	"last_calibrated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "communication_style_check" CHECK ("learner_profiles"."communication_style" IN ('casual', 'balanced', 'formal')),
	CONSTRAINT "explanation_depth_check" CHECK ("learner_profiles"."explanation_depth" IN ('concise', 'standard', 'thorough')),
	CONSTRAINT "mentor_tone_check" CHECK ("learner_profiles"."mentor_tone" IN ('encouraging', 'neutral', 'challenging')),
	CONSTRAINT "education_stage_check" CHECK ("learner_profiles"."education_stage" IN ('elementary', 'high_school', 'university', 'professional', 'self_learner')),
	CONSTRAINT "inferred_pace_check" CHECK ("learner_profiles"."inferred_pace" IS NULL OR "learner_profiles"."inferred_pace" IN ('slow', 'medium', 'fast'))
);
--> statement-breakpoint
ALTER TABLE "concept_chunk_links" ADD CONSTRAINT "concept_chunk_links_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_chunk_links" ADD CONSTRAINT "concept_chunk_links_chunk_id_content_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."content_chunks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_edges" ADD CONSTRAINT "concept_edges_source_id_concepts_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_edges" ADD CONSTRAINT "concept_edges_target_id_concepts_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_lessons" ADD CONSTRAINT "course_lessons_module_id_course_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."course_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_goal_id_learning_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."learning_goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_blocks" ADD CONSTRAINT "lesson_blocks_lesson_id_course_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."course_lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestion_dismissals" ADD CONSTRAINT "suggestion_dismissals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_streaks" ADD CONSTRAINT "user_streaks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_weekly_snapshots" ADD CONSTRAINT "user_weekly_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_goals" ADD CONSTRAINT "learning_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_chunks" ADD CONSTRAINT "content_chunks_learning_object_id_learning_objects_id_fk" FOREIGN KEY ("learning_object_id") REFERENCES "public"."learning_objects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_objects" ADD CONSTRAINT "learning_objects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_log" ADD CONSTRAINT "review_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_log" ADD CONSTRAINT "review_log_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_concept_state" ADD CONSTRAINT "user_concept_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_concept_state" ADD CONSTRAINT "user_concept_state_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_learning_object_id_learning_objects_id_fk" FOREIGN KEY ("learning_object_id") REFERENCES "public"."learning_objects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_answers" ADD CONSTRAINT "user_answers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_answers" ADD CONSTRAINT "user_answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentor_conversations" ADD CONSTRAINT "mentor_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentor_conversations" ADD CONSTRAINT "mentor_conversations_learning_object_id_learning_objects_id_fk" FOREIGN KEY ("learning_object_id") REFERENCES "public"."learning_objects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_profiles" ADD CONSTRAINT "learner_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_edges_source" ON "concept_edges" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "idx_edges_target" ON "concept_edges" USING btree ("target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_edges_unique" ON "concept_edges" USING btree ("source_id","target_id","edge_type");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_concepts_canonical" ON "concepts" USING btree ("canonical_name");--> statement-breakpoint
CREATE INDEX "idx_course_lessons_module" ON "course_lessons" USING btree ("module_id","sequence_order");--> statement-breakpoint
CREATE INDEX "idx_course_modules_goal" ON "course_modules" USING btree ("goal_id","sequence_order");--> statement-breakpoint
CREATE INDEX "idx_lesson_blocks_lesson" ON "lesson_blocks" USING btree ("lesson_id","sequence_order");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_dismissal_user_type_key" ON "suggestion_dismissals" USING btree ("user_id","suggestion_type","suggestion_key");--> statement-breakpoint
CREATE INDEX "idx_dismissal_user" ON "suggestion_dismissals" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_achievement_unique" ON "user_achievements" USING btree ("user_id","achievement_key");--> statement-breakpoint
CREATE INDEX "idx_user_achievements_user" ON "user_achievements" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_streaks_user" ON "user_streaks" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_weekly_snapshot_unique" ON "user_weekly_snapshots" USING btree ("user_id","week_start");--> statement-breakpoint
CREATE INDEX "idx_weekly_snapshot_user" ON "user_weekly_snapshots" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_chunks_learning_object" ON "content_chunks" USING btree ("learning_object_id");--> statement-breakpoint
CREATE INDEX "idx_review_log_user" ON "review_log" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_concept_unique" ON "user_concept_state" USING btree ("user_id","concept_id");--> statement-breakpoint
CREATE INDEX "idx_user_concept_review" ON "user_concept_state" USING btree ("user_id","next_review_at");--> statement-breakpoint
CREATE INDEX "idx_mentor_conv_user" ON "mentor_conversations" USING btree ("user_id","updated_at");
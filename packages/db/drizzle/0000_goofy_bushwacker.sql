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
CREATE TABLE "curriculum_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"sequence_order" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"concept_ids" uuid[] DEFAULT '{}',
	"learning_object_id" uuid,
	"estimated_minutes" integer,
	"status" text DEFAULT 'pending',
	"completed_at" timestamp with time zone,
	"learning_method" text,
	"ai_generated" boolean DEFAULT false,
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
ALTER TABLE "concept_chunk_links" ADD CONSTRAINT "concept_chunk_links_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_chunk_links" ADD CONSTRAINT "concept_chunk_links_chunk_id_content_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."content_chunks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_edges" ADD CONSTRAINT "concept_edges_source_id_concepts_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_edges" ADD CONSTRAINT "concept_edges_target_id_concepts_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_items" ADD CONSTRAINT "curriculum_items_goal_id_learning_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."learning_goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_items" ADD CONSTRAINT "curriculum_items_learning_object_id_learning_objects_id_fk" FOREIGN KEY ("learning_object_id") REFERENCES "public"."learning_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
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
CREATE INDEX "idx_edges_source" ON "concept_edges" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "idx_edges_target" ON "concept_edges" USING btree ("target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_edges_unique" ON "concept_edges" USING btree ("source_id","target_id","edge_type");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_concepts_canonical" ON "concepts" USING btree ("canonical_name");--> statement-breakpoint
CREATE INDEX "idx_curriculum_goal" ON "curriculum_items" USING btree ("goal_id","sequence_order");--> statement-breakpoint
CREATE INDEX "idx_chunks_learning_object" ON "content_chunks" USING btree ("learning_object_id");--> statement-breakpoint
CREATE INDEX "idx_review_log_user" ON "review_log" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_concept_unique" ON "user_concept_state" USING btree ("user_id","concept_id");--> statement-breakpoint
CREATE INDEX "idx_user_concept_review" ON "user_concept_state" USING btree ("user_id","next_review_at");--> statement-breakpoint
CREATE INDEX "idx_mentor_conv_user" ON "mentor_conversations" USING btree ("user_id","updated_at");
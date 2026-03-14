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
ALTER TABLE "learning_goals" ADD COLUMN "learning_mode" text DEFAULT 'understand_first';--> statement-breakpoint
ALTER TABLE "learning_goals" ADD COLUMN "schema_version" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "course_lessons" ADD CONSTRAINT "course_lessons_module_id_course_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."course_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_goal_id_learning_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."learning_goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_blocks" ADD CONSTRAINT "lesson_blocks_lesson_id_course_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."course_lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_course_lessons_module" ON "course_lessons" USING btree ("module_id","sequence_order");--> statement-breakpoint
CREATE INDEX "idx_course_modules_goal" ON "course_modules" USING btree ("goal_id","sequence_order");--> statement-breakpoint
CREATE INDEX "idx_lesson_blocks_lesson" ON "lesson_blocks" USING btree ("lesson_id","sequence_order");
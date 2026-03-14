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
ALTER TABLE "learner_profiles" ADD CONSTRAINT "learner_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "learner_profiles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "learner_profiles_select_own" ON "learner_profiles" FOR SELECT USING (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "learner_profiles_insert_own" ON "learner_profiles" FOR INSERT WITH CHECK (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "learner_profiles_update_own" ON "learner_profiles" FOR UPDATE USING (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "learner_profiles_delete_own" ON "learner_profiles" FOR DELETE USING (user_id = auth.uid());
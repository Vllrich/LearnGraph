-- Post-init: RLS policies, CHECK constraints, and performance indexes.
-- These are cross-cutting concerns that Drizzle schema cannot express.

-- ============================================================
-- CHECK constraints on learning_goals
-- ============================================================
ALTER TABLE "learning_goals" ADD CONSTRAINT "learning_mode_check"
  CHECK ("learning_mode" IS NULL OR "learning_mode" IN ('understand_first','remember_longer','apply_faster','deep_mastery','exam_prep','mentor_heavy'));
--> statement-breakpoint
ALTER TABLE "learning_goals" ADD CONSTRAINT "schema_version_check"
  CHECK ("schema_version" IN (1, 2));
--> statement-breakpoint

-- ============================================================
-- RLS: course_modules (chain: module -> goal -> user)
-- ============================================================
ALTER TABLE "course_modules" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "course_modules_select_own" ON "course_modules" FOR SELECT
  USING (goal_id IN (SELECT id FROM learning_goals WHERE user_id = auth.uid()));
--> statement-breakpoint
CREATE POLICY "course_modules_insert_own" ON "course_modules" FOR INSERT
  WITH CHECK (goal_id IN (SELECT id FROM learning_goals WHERE user_id = auth.uid()));
--> statement-breakpoint
CREATE POLICY "course_modules_update_own" ON "course_modules" FOR UPDATE
  USING (goal_id IN (SELECT id FROM learning_goals WHERE user_id = auth.uid()));
--> statement-breakpoint
CREATE POLICY "course_modules_delete_own" ON "course_modules" FOR DELETE
  USING (goal_id IN (SELECT id FROM learning_goals WHERE user_id = auth.uid()));
--> statement-breakpoint

-- ============================================================
-- RLS: course_lessons (chain: lesson -> module -> goal -> user)
-- ============================================================
ALTER TABLE "course_lessons" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "course_lessons_select_own" ON "course_lessons" FOR SELECT
  USING (module_id IN (
    SELECT id FROM course_modules WHERE goal_id IN (
      SELECT id FROM learning_goals WHERE user_id = auth.uid()
    )
  ));
--> statement-breakpoint
CREATE POLICY "course_lessons_insert_own" ON "course_lessons" FOR INSERT
  WITH CHECK (module_id IN (
    SELECT id FROM course_modules WHERE goal_id IN (
      SELECT id FROM learning_goals WHERE user_id = auth.uid()
    )
  ));
--> statement-breakpoint
CREATE POLICY "course_lessons_update_own" ON "course_lessons" FOR UPDATE
  USING (module_id IN (
    SELECT id FROM course_modules WHERE goal_id IN (
      SELECT id FROM learning_goals WHERE user_id = auth.uid()
    )
  ));
--> statement-breakpoint
CREATE POLICY "course_lessons_delete_own" ON "course_lessons" FOR DELETE
  USING (module_id IN (
    SELECT id FROM course_modules WHERE goal_id IN (
      SELECT id FROM learning_goals WHERE user_id = auth.uid()
    )
  ));
--> statement-breakpoint

-- ============================================================
-- RLS: lesson_blocks (chain: block -> lesson -> module -> goal -> user)
-- ============================================================
ALTER TABLE "lesson_blocks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "lesson_blocks_select_own" ON "lesson_blocks" FOR SELECT
  USING (lesson_id IN (
    SELECT id FROM course_lessons WHERE module_id IN (
      SELECT id FROM course_modules WHERE goal_id IN (
        SELECT id FROM learning_goals WHERE user_id = auth.uid()
      )
    )
  ));
--> statement-breakpoint
CREATE POLICY "lesson_blocks_insert_own" ON "lesson_blocks" FOR INSERT
  WITH CHECK (lesson_id IN (
    SELECT id FROM course_lessons WHERE module_id IN (
      SELECT id FROM course_modules WHERE goal_id IN (
        SELECT id FROM learning_goals WHERE user_id = auth.uid()
      )
    )
  ));
--> statement-breakpoint
CREATE POLICY "lesson_blocks_update_own" ON "lesson_blocks" FOR UPDATE
  USING (lesson_id IN (
    SELECT id FROM course_lessons WHERE module_id IN (
      SELECT id FROM course_modules WHERE goal_id IN (
        SELECT id FROM learning_goals WHERE user_id = auth.uid()
      )
    )
  ));
--> statement-breakpoint
CREATE POLICY "lesson_blocks_delete_own" ON "lesson_blocks" FOR DELETE
  USING (lesson_id IN (
    SELECT id FROM course_lessons WHERE module_id IN (
      SELECT id FROM course_modules WHERE goal_id IN (
        SELECT id FROM learning_goals WHERE user_id = auth.uid()
      )
    )
  ));
--> statement-breakpoint

-- ============================================================
-- RLS: suggestion_dismissals (direct user_id ownership)
-- ============================================================
ALTER TABLE "suggestion_dismissals" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "suggestion_dismissals_select_own" ON "suggestion_dismissals" FOR SELECT
  USING (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "suggestion_dismissals_insert_own" ON "suggestion_dismissals" FOR INSERT
  WITH CHECK (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "suggestion_dismissals_delete_own" ON "suggestion_dismissals" FOR DELETE
  USING (user_id = auth.uid());
--> statement-breakpoint

-- ============================================================
-- Performance indexes
-- NOTE: Drizzle wraps each migration in a transaction, so CONCURRENTLY
-- cannot be used here. On a populated DB, rebuild these with a separate
-- non-transactional migration if needed.
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_learning_objects_user_status
  ON learning_objects (user_id, status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_learning_goals_user_status
  ON learning_goals (user_id, status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_questions_lo_id
  ON questions (learning_object_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_questions_concept_ids
  ON questions USING GIN (concept_ids);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_questions_not_excluded
  ON questions (learning_object_id) WHERE COALESCE(is_excluded, false) = false;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_user_answers_user_id
  ON user_answers (user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_review_log_concept_id
  ON review_log (concept_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_concept_chunk_links_chunk_id
  ON concept_chunk_links (chunk_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_course_modules_goal_status
  ON course_modules (goal_id, status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_course_lessons_module_status
  ON course_lessons (module_id, status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_lesson_blocks_lesson_status
  ON lesson_blocks (lesson_id, status);
--> statement-breakpoint

-- HNSW vector index on concepts.embedding for similarity dedup search
-- m=16, ef_construction=64 balances build time vs query accuracy
CREATE INDEX IF NOT EXISTS idx_concepts_embedding_hnsw
  ON concepts USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

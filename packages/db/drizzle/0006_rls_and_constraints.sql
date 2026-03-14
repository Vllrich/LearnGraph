-- CHECK constraints on learning_goals
--> statement-breakpoint
ALTER TABLE "learning_goals" ADD CONSTRAINT "learning_mode_check"
  CHECK ("learning_mode" IS NULL OR "learning_mode" IN ('understand_first','remember_longer','apply_faster','deep_mastery','exam_prep','mentor_heavy'));
--> statement-breakpoint
ALTER TABLE "learning_goals" ADD CONSTRAINT "schema_version_check"
  CHECK ("schema_version" IN (1, 2));

-- RLS for course_modules (user_id lives on learning_goals)
--> statement-breakpoint
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

-- RLS for course_lessons (chain: lesson → module → goal → user)
--> statement-breakpoint
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

-- RLS for lesson_blocks (chain: block → lesson → module → goal → user)
--> statement-breakpoint
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

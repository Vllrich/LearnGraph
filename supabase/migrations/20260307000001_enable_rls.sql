-- Enable Row-Level Security on ALL tables
-- Ref: TODO §0.3 — RLS policies go in .sql migration files, not in Drizzle

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE concept_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE concept_chunk_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_concept_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_items ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════
-- USERS — own row only
-- ═══════════════════════════════════════════

CREATE POLICY "users_select_own"
  ON users FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Insert handled by auth trigger / service role only
CREATE POLICY "users_insert_own"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- ═══════════════════════════════════════════
-- LEARNING OBJECTS — user_id scoped
-- ═══════════════════════════════════════════

CREATE POLICY "learning_objects_select_own"
  ON learning_objects FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "learning_objects_insert_own"
  ON learning_objects FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "learning_objects_update_own"
  ON learning_objects FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "learning_objects_delete_own"
  ON learning_objects FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ═══════════════════════════════════════════
-- CONTENT CHUNKS — via learning_objects.user_id
-- ═══════════════════════════════════════════

CREATE POLICY "content_chunks_select_own"
  ON content_chunks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM learning_objects
      WHERE learning_objects.id = content_chunks.learning_object_id
        AND learning_objects.user_id = auth.uid()
    )
  );

CREATE POLICY "content_chunks_insert_own"
  ON content_chunks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM learning_objects
      WHERE learning_objects.id = content_chunks.learning_object_id
        AND learning_objects.user_id = auth.uid()
    )
  );

CREATE POLICY "content_chunks_delete_own"
  ON content_chunks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM learning_objects
      WHERE learning_objects.id = content_chunks.learning_object_id
        AND learning_objects.user_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════
-- CONCEPTS — shared, read-accessible to all authenticated users
-- Writes restricted to service role (AI pipeline)
-- ═══════════════════════════════════════════

CREATE POLICY "concepts_select_authenticated"
  ON concepts FOR SELECT
  TO authenticated
  USING (true);

-- ═══════════════════════════════════════════
-- CONCEPT EDGES — shared, read-accessible to all authenticated
-- ═══════════════════════════════════════════

CREATE POLICY "concept_edges_select_authenticated"
  ON concept_edges FOR SELECT
  TO authenticated
  USING (true);

-- ═══════════════════════════════════════════
-- CONCEPT CHUNK LINKS — shared, read-accessible to all authenticated
-- ═══════════════════════════════════════════

CREATE POLICY "concept_chunk_links_select_authenticated"
  ON concept_chunk_links FOR SELECT
  TO authenticated
  USING (true);

-- ═══════════════════════════════════════════
-- USER CONCEPT STATE — user_id scoped
-- ═══════════════════════════════════════════

CREATE POLICY "user_concept_state_select_own"
  ON user_concept_state FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "user_concept_state_insert_own"
  ON user_concept_state FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_concept_state_update_own"
  ON user_concept_state FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ═══════════════════════════════════════════
-- REVIEW LOG — user_id scoped, append-only (no update/delete)
-- ═══════════════════════════════════════════

CREATE POLICY "review_log_select_own"
  ON review_log FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "review_log_insert_own"
  ON review_log FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ═══════════════════════════════════════════
-- QUESTIONS — accessible via learning_objects.user_id
-- ═══════════════════════════════════════════

CREATE POLICY "questions_select_own"
  ON questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM learning_objects
      WHERE learning_objects.id = questions.learning_object_id
        AND learning_objects.user_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════
-- USER ANSWERS — user_id scoped
-- ═══════════════════════════════════════════

CREATE POLICY "user_answers_select_own"
  ON user_answers FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "user_answers_insert_own"
  ON user_answers FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ═══════════════════════════════════════════
-- MENTOR CONVERSATIONS — user_id scoped
-- ═══════════════════════════════════════════

CREATE POLICY "mentor_conversations_select_own"
  ON mentor_conversations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "mentor_conversations_insert_own"
  ON mentor_conversations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "mentor_conversations_update_own"
  ON mentor_conversations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "mentor_conversations_delete_own"
  ON mentor_conversations FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ═══════════════════════════════════════════
-- LEARNING GOALS — user_id scoped
-- ═══════════════════════════════════════════

CREATE POLICY "learning_goals_select_own"
  ON learning_goals FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "learning_goals_insert_own"
  ON learning_goals FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "learning_goals_update_own"
  ON learning_goals FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "learning_goals_delete_own"
  ON learning_goals FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ═══════════════════════════════════════════
-- CURRICULUM ITEMS — via learning_goals.user_id
-- ═══════════════════════════════════════════

CREATE POLICY "curriculum_items_select_own"
  ON curriculum_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM learning_goals
      WHERE learning_goals.id = curriculum_items.goal_id
        AND learning_goals.user_id = auth.uid()
    )
  );

CREATE POLICY "curriculum_items_insert_own"
  ON curriculum_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM learning_goals
      WHERE learning_goals.id = curriculum_items.goal_id
        AND learning_goals.user_id = auth.uid()
    )
  );

CREATE POLICY "curriculum_items_update_own"
  ON curriculum_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM learning_goals
      WHERE learning_goals.id = curriculum_items.goal_id
        AND learning_goals.user_id = auth.uid()
    )
  );

CREATE POLICY "curriculum_items_delete_own"
  ON curriculum_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM learning_goals
      WHERE learning_goals.id = curriculum_items.goal_id
        AND learning_goals.user_id = auth.uid()
    )
  );

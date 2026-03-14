-- Performance optimization indexes
-- Addresses: missing indexes on high-traffic filter columns, vector search, reverse lookups

-- learning_objects: filtered by user_id + status on library list, mentor chat, export
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_objects_user_status
  ON learning_objects (user_id, status);

-- learning_goals: list/filter by user + status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_goals_user_status
  ON learning_goals (user_id, status);

-- questions: fetched by learning_object_id on quiz generation and review
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_questions_lo_id
  ON questions (learning_object_id);

-- questions: GIN index for array-contains queries on concept_ids
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_questions_concept_ids
  ON questions USING GIN (concept_ids);

-- questions: filter out excluded questions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_questions_not_excluded
  ON questions (learning_object_id) WHERE COALESCE(is_excluded, false) = false;

-- user_answers: queried by user_id for error log
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_answers_user_id
  ON user_answers (user_id);

-- review_log: joined on concept_id for analytics and graph data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_review_log_concept_id
  ON review_log (concept_id);

-- concept_chunk_links: reverse lookup chunk → concepts (used in concept extraction, graph)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_concept_chunk_links_chunk_id
  ON concept_chunk_links (chunk_id);

-- course tables: filter by status for progress queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_course_modules_goal_status
  ON course_modules (goal_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_course_lessons_module_status
  ON course_lessons (module_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lesson_blocks_lesson_status
  ON lesson_blocks (lesson_id, status);

-- HNSW vector index on concepts.embedding for similarity dedup search
-- m=16, ef_construction=64 balances build time vs query accuracy
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_concepts_embedding_hnsw
  ON concepts USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

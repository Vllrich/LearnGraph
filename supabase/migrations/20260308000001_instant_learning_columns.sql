-- Add columns for the Instant Learning feature
-- Ref: learning_goals needs goal_type, current_level, time_budget, exam_date
-- Ref: curriculum_items needs learning_method, ai_generated

ALTER TABLE learning_goals
  ADD COLUMN IF NOT EXISTS goal_type TEXT,
  ADD COLUMN IF NOT EXISTS current_level TEXT,
  ADD COLUMN IF NOT EXISTS time_budget_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS exam_date TIMESTAMPTZ;

ALTER TABLE curriculum_items
  ADD COLUMN IF NOT EXISTS learning_method TEXT,
  ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT FALSE;

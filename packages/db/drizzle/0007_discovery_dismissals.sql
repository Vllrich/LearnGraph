CREATE TABLE IF NOT EXISTS "suggestion_dismissals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "suggestion_type" text NOT NULL,
  "suggestion_key" text NOT NULL,
  "created_at" timestamptz DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_dismissal_user_type_key" ON "suggestion_dismissals" ("user_id", "suggestion_type", "suggestion_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_dismissal_user" ON "suggestion_dismissals" ("user_id");

-- RLS for suggestion_dismissals
--> statement-breakpoint
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

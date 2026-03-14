import { pgTable, uuid, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { users } from "./users";

export const suggestionDismissals = pgTable(
  "suggestion_dismissals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    suggestionType: text("suggestion_type").notNull(),
    suggestionKey: text("suggestion_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_dismissal_user_type_key").on(
      table.userId,
      table.suggestionType,
      table.suggestionKey
    ),
    index("idx_dismissal_user").on(table.userId),
  ]
);

export type SuggestionDismissal = typeof suggestionDismissals.$inferSelect;
export type NewSuggestionDismissal = typeof suggestionDismissals.$inferInsert;

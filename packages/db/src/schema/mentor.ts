import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { learningObjects } from "./learning-objects";

export const mentorConversations = pgTable(
  "mentor_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    learningObjectId: uuid("learning_object_id").references(
      () => learningObjects.id,
      { onDelete: "set null" }
    ),
    title: text("title"),
    messages: jsonb("messages").notNull().default([]),
    teachingObjective: text("teaching_objective"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_mentor_conv_user").on(table.userId, table.updatedAt),
  ]
);

export type MentorConversation = typeof mentorConversations.$inferSelect;
export type NewMentorConversation = typeof mentorConversations.$inferInsert;

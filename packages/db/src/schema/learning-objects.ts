import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  vector,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const learningObjects = pgTable("learning_objects", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  sourceType: text("source_type").notNull(),
  sourceUrl: text("source_url"),
  filePath: text("file_path"),
  rawText: text("raw_text"),
  status: text("status").default("processing").notNull(),
  metadata: jsonb("metadata").default({}),
  summaryTldr: text("summary_tldr"),
  summaryKeyPoints: text("summary_key_points"),
  summaryDeep: text("summary_deep"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const contentChunks = pgTable(
  "content_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    learningObjectId: uuid("learning_object_id")
      .references(() => learningObjects.id, { onDelete: "cascade" })
      .notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    sectionTitle: text("section_title"),
    pageNumber: integer("page_number"),
    tokenCount: integer("token_count"),
    embedding: vector("embedding", { dimensions: 1536 }),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_chunks_learning_object").on(table.learningObjectId),
  ]
);

export type LearningObject = typeof learningObjects.$inferSelect;
export type NewLearningObject = typeof learningObjects.$inferInsert;
export type ContentChunk = typeof contentChunks.$inferSelect;
export type NewContentChunk = typeof contentChunks.$inferInsert;

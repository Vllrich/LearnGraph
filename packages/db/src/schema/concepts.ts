import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  timestamp,
  uniqueIndex,
  index,
  primaryKey,
  vector,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { contentChunks } from "./learning-objects";

export const concepts = pgTable(
  "concepts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    canonicalName: text("canonical_name").notNull(),
    displayName: text("display_name").notNull(),
    definition: text("definition"),
    aliases: text("aliases").array().default([]),
    difficultyLevel: integer("difficulty_level").default(3),
    bloomLevel: text("bloom_level").default("understand"),
    domain: text("domain"),
    embedding: vector("embedding", { dimensions: 1536 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_concepts_canonical").on(table.canonicalName),
    check(
      "difficulty_level_check",
      sql`${table.difficultyLevel} BETWEEN 1 AND 5`
    ),
  ]
);

export const conceptEdges = pgTable(
  "concept_edges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .references(() => concepts.id, { onDelete: "cascade" })
      .notNull(),
    targetId: uuid("target_id")
      .references(() => concepts.id, { onDelete: "cascade" })
      .notNull(),
    edgeType: text("edge_type").notNull(),
    confidence: real("confidence").default(1.0),
    sourceOrigin: text("source_origin").default("ai"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_edges_source").on(table.sourceId),
    index("idx_edges_target").on(table.targetId),
    uniqueIndex("idx_edges_unique").on(
      table.sourceId,
      table.targetId,
      table.edgeType
    ),
  ]
);

export const conceptChunkLinks = pgTable(
  "concept_chunk_links",
  {
    conceptId: uuid("concept_id")
      .references(() => concepts.id, { onDelete: "cascade" })
      .notNull(),
    chunkId: uuid("chunk_id")
      .references(() => contentChunks.id, { onDelete: "cascade" })
      .notNull(),
    relevanceScore: real("relevance_score").default(1.0),
  },
  (table) => [primaryKey({ columns: [table.conceptId, table.chunkId] })]
);

export type Concept = typeof concepts.$inferSelect;
export type NewConcept = typeof concepts.$inferInsert;
export type ConceptEdge = typeof conceptEdges.$inferSelect;
export type NewConceptEdge = typeof conceptEdges.$inferInsert;

import { pgTable, uuid, text, timestamp, jsonb, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").unique().notNull(),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    timezone: text("timezone").default("UTC"),
    onboarding: jsonb("onboarding").default({ completed: false }),
    preferences: jsonb("preferences").default({}),
    subscription: text("subscription").default("free"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    check(
      "subscription_check",
      sql`${table.subscription} IN ('free', 'pro', 'team')`
    ),
  ]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

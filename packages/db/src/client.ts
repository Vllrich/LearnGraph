import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const globalForDb = globalThis as unknown as { _pgClient?: ReturnType<typeof postgres> };

const isProd = process.env.NODE_ENV === "production";

const client =
  globalForDb._pgClient ??
  postgres(connectionString, {
    prepare: false,
    max: isProd ? 1 : 5,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
    onnotice: () => {},
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb._pgClient = client;
}

export const db = drizzle(client, { schema });
export type Database = typeof db;

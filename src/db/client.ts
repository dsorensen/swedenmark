import { type PostgresJsDatabase, drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __swedenmark_pg__: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var __swedenmark_db__: PostgresJsDatabase<typeof schema> | undefined;
}

function getConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and adjust if needed.",
    );
  }
  return url;
}

export function getDb(): PostgresJsDatabase<typeof schema> {
  if (!global.__swedenmark_db__) {
    global.__swedenmark_pg__ = postgres(getConnectionString(), {
      max: Number(process.env.DATABASE_POOL_SIZE ?? 5),
      prepare: false,
    });
    global.__swedenmark_db__ = drizzle(global.__swedenmark_pg__, { schema });
  }
  return global.__swedenmark_db__;
}

export async function closeDb(): Promise<void> {
  if (global.__swedenmark_pg__) {
    await global.__swedenmark_pg__.end({ timeout: 5 });
    global.__swedenmark_pg__ = undefined;
    global.__swedenmark_db__ = undefined;
  }
}

export { schema };

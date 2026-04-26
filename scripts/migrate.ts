#!/usr/bin/env tsx
import "dotenv/config";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { closeDb, getDb } from "../src/db/client";

async function main() {
  console.log(`Running migrations against ${maskUrl(process.env.DATABASE_URL)}`);
  await migrate(getDb(), { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");
  await closeDb();
}

function maskUrl(url: string | undefined): string {
  if (!url) return "<unset>";
  return url.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:****@");
}

main().catch(async (err) => {
  console.error("Migration failed:", err);
  await closeDb();
  process.exit(1);
});

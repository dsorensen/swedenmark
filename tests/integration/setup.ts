import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { describe } from "vitest";
import { closeDb, getDb, schema } from "../../src/db/client";
import { leadQualificationProcess } from "../../src/processes/lead-qualification";

export const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

/** describe block that skips entirely when DATABASE_URL is not set. */
export const describeIntegration = describe.skipIf(!hasDatabaseUrl);

export async function resetDb(): Promise<void> {
  const db = getDb();
  await migrate(db, { migrationsFolder: "./drizzle" });
  await db.delete(schema.auditEvent);
  await db.delete(schema.processStep);
  await db.delete(schema.processRun);
  await db.delete(schema.processDefinition);

  await db.insert(schema.processDefinition).values({
    slug: leadQualificationProcess.slug,
    title: leadQualificationProcess.title,
    version: leadQualificationProcess.version,
    stepsDag: leadQualificationProcess.steps,
  });
}

export async function teardownDb(): Promise<void> {
  await closeDb();
}

export async function findDefinition(slug: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.processDefinition)
    .where(eq(schema.processDefinition.slug, slug))
    .limit(1);
  return row;
}

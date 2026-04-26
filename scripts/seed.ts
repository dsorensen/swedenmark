#!/usr/bin/env tsx
import "dotenv/config";
import { eq } from "drizzle-orm";
import { closeDb, getDb, schema } from "../src/db/client";
import { leadQualificationProcess } from "../src/processes/lead-qualification";

async function main() {
  const db = getDb();

  const [existing] = await db
    .select()
    .from(schema.processDefinition)
    .where(eq(schema.processDefinition.slug, leadQualificationProcess.slug))
    .limit(1);

  if (existing) {
    await db
      .update(schema.processDefinition)
      .set({
        title: leadQualificationProcess.title,
        version: leadQualificationProcess.version,
        stepsDag: leadQualificationProcess.steps,
      })
      .where(eq(schema.processDefinition.id, existing.id));
    console.log(`Updated process definition: ${leadQualificationProcess.slug}`);
  } else {
    const [inserted] = await db
      .insert(schema.processDefinition)
      .values({
        slug: leadQualificationProcess.slug,
        title: leadQualificationProcess.title,
        version: leadQualificationProcess.version,
        stepsDag: leadQualificationProcess.steps,
      })
      .returning();
    console.log(`Inserted process definition: ${inserted.slug} (${inserted.id})`);
  }

  await closeDb();
}

main().catch(async (err) => {
  console.error("Seed failed:", err);
  await closeDb();
  process.exit(1);
});

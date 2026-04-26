import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const processDefinition = pgTable("process_definition", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  version: integer("version").notNull().default(1),
  title: text("title").notNull(),
  // Ordered list of step descriptors:
  //   { id: string, type: "auto" | "human", adapter: string, prompt_key?: string, title: string }
  stepsDag: jsonb("steps_dag").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

// Run statuses: "running" | "awaiting_human" | "completed" | "failed"
export const processRun = pgTable(
  "process_run",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    processDefinitionId: uuid("process_definition_id")
      .notNull()
      .references(() => processDefinition.id),
    status: text("status").notNull().default("running"),
    input: jsonb("input").notNull().default(sql`'{}'::jsonb`),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    statusIdx: index("process_run_status_idx").on(table.status),
  }),
);

// Step statuses: "pending" | "running" | "awaiting_human" | "completed" | "failed"
export const processStep = pgTable(
  "process_step",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => processRun.id, { onDelete: "cascade" }),
    definitionStepId: text("definition_step_id").notNull(),
    stepIndex: integer("step_index").notNull(),
    type: text("type").notNull(), // "auto" | "human"
    adapter: text("adapter").notNull(),
    title: text("title").notNull(),
    status: text("status").notNull().default("pending"),
    inputJson: jsonb("input_json"),
    outputJson: jsonb("output_json"),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (table) => ({
    runIdx: index("process_step_run_idx").on(table.runId, table.stepIndex),
  }),
);

// Audit events: "auto_completed" | "human_edited" | "human_approved" | "run_started" | "run_completed" | "run_failed"
export const auditEvent = pgTable(
  "audit_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => processRun.id, { onDelete: "cascade" }),
    stepId: uuid("step_id").references(() => processStep.id, {
      onDelete: "cascade",
    }),
    actor: text("actor").notNull(), // "system" | "user"
    kind: text("kind").notNull(),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (table) => ({
    runIdx: index("audit_event_run_idx").on(table.runId, table.createdAt),
  }),
);

export type ProcessDefinitionRow = typeof processDefinition.$inferSelect;
export type ProcessRunRow = typeof processRun.$inferSelect;
export type ProcessStepRow = typeof processStep.$inferSelect;
export type AuditEventRow = typeof auditEvent.$inferSelect;

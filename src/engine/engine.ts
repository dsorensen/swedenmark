import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "../db/client";
import type { ProcessRunRow, ProcessStepRow } from "../db/schema";
import type { StepDefinition } from "../processes/types";
import { adapters } from "./adapters";

export type RunStatus = "running" | "awaiting_human" | "completed" | "failed";
export type StepStatus = "pending" | "running" | "awaiting_human" | "completed" | "failed";

export interface RunWithSteps {
  run: ProcessRunRow;
  steps: ProcessStepRow[];
}

export interface CreateRunInput {
  processSlug: string;
  input: Record<string, unknown>;
}

export class EngineError extends Error {
  status: number;
  code: string;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = "EngineError";
  }
}

export async function createRun(args: CreateRunInput): Promise<RunWithSteps> {
  const db = getDb();
  const [definition] = await db
    .select()
    .from(schema.processDefinition)
    .where(eq(schema.processDefinition.slug, args.processSlug))
    .limit(1);
  if (!definition) {
    throw new EngineError(
      "process_not_found",
      `Process definition not found: ${args.processSlug}`,
      404,
    );
  }

  const stepsDag = parseStepsDag(definition.stepsDag);

  const [run] = await db
    .insert(schema.processRun)
    .values({
      processDefinitionId: definition.id,
      status: "running",
      input: args.input,
    })
    .returning();

  const insertedSteps = await db
    .insert(schema.processStep)
    .values(
      stepsDag.map((step, index) => ({
        runId: run.id,
        definitionStepId: step.id,
        stepIndex: index,
        type: step.type,
        adapter: step.adapter,
        title: step.title,
        status: "pending" as StepStatus,
      })),
    )
    .returning();

  await db.insert(schema.auditEvent).values({
    runId: run.id,
    actor: "system",
    kind: "run_started",
    payload: { processSlug: definition.slug, version: definition.version },
  });

  // Drive the engine forward until it completes or pauses.
  return advance(run.id);
}

export async function getRun(runId: string): Promise<RunWithSteps> {
  const db = getDb();
  const [run] = await db
    .select()
    .from(schema.processRun)
    .where(eq(schema.processRun.id, runId))
    .limit(1);
  if (!run) {
    throw new EngineError("run_not_found", `Run not found: ${runId}`, 404);
  }
  const steps = await db
    .select()
    .from(schema.processStep)
    .where(eq(schema.processStep.runId, runId))
    .orderBy(asc(schema.processStep.stepIndex));
  return { run, steps };
}

export interface ApproveStepInput {
  runId: string;
  stepId: string;
  /** Operator-provided payload that becomes the step output. */
  output?: Record<string, unknown>;
  edited?: boolean;
}

export async function approveStep(args: ApproveStepInput): Promise<RunWithSteps> {
  const db = getDb();
  const [step] = await db
    .select()
    .from(schema.processStep)
    .where(and(eq(schema.processStep.id, args.stepId), eq(schema.processStep.runId, args.runId)))
    .limit(1);

  if (!step) {
    throw new EngineError(
      "step_not_found",
      `Step ${args.stepId} not found on run ${args.runId}`,
      404,
    );
  }
  if (step.type !== "human") {
    throw new EngineError(
      "step_not_human_gate",
      `Step ${step.definitionStepId} is not a human gate (type=${step.type}).`,
      400,
    );
  }
  if (step.status !== "awaiting_human") {
    throw new EngineError(
      "step_not_awaiting",
      `Step ${step.definitionStepId} is not awaiting human input (status=${step.status}).`,
      409,
    );
  }

  const output = args.output ?? (step.inputJson as Record<string, unknown> | null) ?? {};

  await db
    .update(schema.processStep)
    .set({
      status: "completed",
      outputJson: output,
      finishedAt: new Date(),
    })
    .where(eq(schema.processStep.id, step.id));

  if (args.edited) {
    await db.insert(schema.auditEvent).values({
      runId: args.runId,
      stepId: step.id,
      actor: "user",
      kind: "human_edited",
      payload: { output },
    });
  }
  await db.insert(schema.auditEvent).values({
    runId: args.runId,
    stepId: step.id,
    actor: "user",
    kind: "human_approved",
    payload: null,
  });

  return advance(args.runId);
}

/**
 * Advance the run: execute consecutive auto steps until we hit a human
 * gate, exhaust all steps, or fail. Persists everything as it goes.
 */
async function advance(runId: string): Promise<RunWithSteps> {
  const db = getDb();

  for (;;) {
    const { run, steps } = await getRun(runId);
    if (run.status === "completed" || run.status === "failed") {
      return { run, steps };
    }

    const nextStep = steps.find((s) => s.status === "pending" || s.status === "awaiting_human");
    if (!nextStep) {
      // All steps done — mark run completed.
      const [updated] = await db
        .update(schema.processRun)
        .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.processRun.id, runId))
        .returning();
      await db.insert(schema.auditEvent).values({
        runId,
        actor: "system",
        kind: "run_completed",
        payload: null,
      });
      return { run: updated, steps };
    }

    if (nextStep.status === "awaiting_human") {
      // Run paused; surface back to caller.
      if (run.status !== "awaiting_human") {
        await db
          .update(schema.processRun)
          .set({ status: "awaiting_human", updatedAt: new Date() })
          .where(eq(schema.processRun.id, runId));
      }
      return getRun(runId);
    }

    if (nextStep.type === "human") {
      // Move human-gate step into awaiting; stamp the input with current run context.
      const aggregate = aggregateStepOutputs(steps, nextStep.stepIndex);
      await db
        .update(schema.processStep)
        .set({
          status: "awaiting_human",
          inputJson: aggregate,
          startedAt: new Date(),
        })
        .where(eq(schema.processStep.id, nextStep.id));
      await db
        .update(schema.processRun)
        .set({ status: "awaiting_human", updatedAt: new Date() })
        .where(eq(schema.processRun.id, runId));
      return getRun(runId);
    }

    // Auto step: run the adapter.
    const adapter = adapters[nextStep.adapter];
    if (!adapter) {
      await failRun(runId, nextStep.id, `Unknown adapter: ${nextStep.adapter}`);
      return getRun(runId);
    }

    const aggregate = aggregateStepOutputs(steps, nextStep.stepIndex);
    await db
      .update(schema.processStep)
      .set({ status: "running", startedAt: new Date(), inputJson: aggregate })
      .where(eq(schema.processStep.id, nextStep.id));

    try {
      const output = await adapter(aggregate, {
        runId,
        stepId: nextStep.id,
        runInput: run.input,
      });
      await db
        .update(schema.processStep)
        .set({
          status: "completed",
          outputJson: output,
          finishedAt: new Date(),
        })
        .where(eq(schema.processStep.id, nextStep.id));
      await db.insert(schema.auditEvent).values({
        runId,
        stepId: nextStep.id,
        actor: "system",
        kind: "auto_completed",
        payload: { adapter: nextStep.adapter },
      });
    } catch (err) {
      await failRun(runId, nextStep.id, err instanceof Error ? err.message : String(err));
      return getRun(runId);
    }
  }
}

function aggregateStepOutputs(steps: ProcessStepRow[], uptoIndex: number): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const s of steps) {
    if (s.stepIndex >= uptoIndex) continue;
    if (s.outputJson && typeof s.outputJson === "object") {
      Object.assign(merged, s.outputJson);
    }
  }
  return merged;
}

async function failRun(runId: string, stepId: string, message: string): Promise<void> {
  const db = getDb();
  await db
    .update(schema.processStep)
    .set({ status: "failed", error: message, finishedAt: new Date() })
    .where(eq(schema.processStep.id, stepId));
  await db
    .update(schema.processRun)
    .set({ status: "failed", error: message, updatedAt: new Date() })
    .where(eq(schema.processRun.id, runId));
  await db.insert(schema.auditEvent).values({
    runId,
    stepId,
    actor: "system",
    kind: "run_failed",
    payload: { message },
  });
}

function parseStepsDag(value: unknown): StepDefinition[] {
  if (!Array.isArray(value)) {
    throw new EngineError("invalid_definition", "Process steps_dag must be an array.", 500);
  }
  return value.map((raw, idx) => {
    if (!raw || typeof raw !== "object") {
      throw new EngineError("invalid_definition", `Step ${idx} is not an object.`, 500);
    }
    const r = raw as Record<string, unknown>;
    const id = r.id;
    const type = r.type;
    const adapter = r.adapter;
    const title = r.title;
    if (typeof id !== "string" || typeof adapter !== "string" || typeof title !== "string") {
      throw new EngineError(
        "invalid_definition",
        `Step ${idx} missing required fields (id, adapter, title).`,
        500,
      );
    }
    if (type !== "auto" && type !== "human") {
      throw new EngineError(
        "invalid_definition",
        `Step ${idx} has invalid type: ${String(type)}.`,
        500,
      );
    }
    return { id, type, adapter, title, promptKey: r.promptKey as string | undefined };
  });
}

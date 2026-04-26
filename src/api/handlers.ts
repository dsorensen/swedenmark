import { z } from "zod";
import { EngineError, type RunWithSteps, approveStep, createRun, getRun } from "../engine/engine";

const createRunSchema = z.object({
  processSlug: z.string().min(1).default("lead-qualification"),
  input: z.object({ rawText: z.string().min(1) }).passthrough(),
});

const approveSchema = z.object({
  output: z.record(z.string(), z.unknown()).optional(),
  edited: z.boolean().optional(),
});

export interface ApiError {
  error: { code: string; message: string };
}

export type ApiResponse<T> = { status: number; body: T } | { status: number; body: ApiError };

function serializeRun(result: RunWithSteps) {
  return {
    run: {
      id: result.run.id,
      status: result.run.status,
      processDefinitionId: result.run.processDefinitionId,
      input: result.run.input,
      error: result.run.error,
      createdAt: result.run.createdAt,
      updatedAt: result.run.updatedAt,
      completedAt: result.run.completedAt,
    },
    steps: result.steps.map((s) => ({
      id: s.id,
      definitionStepId: s.definitionStepId,
      stepIndex: s.stepIndex,
      type: s.type,
      adapter: s.adapter,
      title: s.title,
      status: s.status,
      input: s.inputJson,
      output: s.outputJson,
      error: s.error,
      startedAt: s.startedAt,
      finishedAt: s.finishedAt,
    })),
  };
}

export async function handleCreateRun(rawBody: unknown): Promise<ApiResponse<unknown>> {
  const parsed = createRunSchema.safeParse(rawBody);
  if (!parsed.success) {
    return badRequest("invalid_body", parsed.error.message);
  }
  try {
    const result = await createRun(parsed.data);
    return { status: 201, body: serializeRun(result) };
  } catch (err) {
    return engineErrorToResponse(err);
  }
}

export async function handleGetRun(runId: string): Promise<ApiResponse<unknown>> {
  if (!runId) return badRequest("invalid_run_id", "Missing run id.");
  try {
    const result = await getRun(runId);
    return { status: 200, body: serializeRun(result) };
  } catch (err) {
    return engineErrorToResponse(err);
  }
}

export async function handleApproveStep(
  runId: string,
  stepId: string,
  rawBody: unknown,
): Promise<ApiResponse<unknown>> {
  if (!runId || !stepId) return badRequest("invalid_id", "Missing run or step id.");
  const parsed = approveSchema.safeParse(rawBody ?? {});
  if (!parsed.success) {
    return badRequest("invalid_body", parsed.error.message);
  }
  try {
    const result = await approveStep({
      runId,
      stepId,
      output: parsed.data.output,
      edited: parsed.data.edited,
    });
    return { status: 200, body: serializeRun(result) };
  } catch (err) {
    return engineErrorToResponse(err);
  }
}

function badRequest(code: string, message: string): ApiResponse<unknown> {
  return { status: 400, body: { error: { code, message } } };
}

function engineErrorToResponse(err: unknown): ApiResponse<unknown> {
  if (err instanceof EngineError) {
    return { status: err.status, body: { error: { code: err.code, message: err.message } } };
  }
  console.error("[api] unexpected error", err);
  return {
    status: 500,
    body: {
      error: {
        code: "internal_error",
        message: err instanceof Error ? err.message : "unknown error",
      },
    },
  };
}

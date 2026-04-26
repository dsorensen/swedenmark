/**
 * Shape of the JSON payload returned by `POST/GET /api/runs/...`. Mirrors
 * `serializeRun` in src/api/handlers.ts. Kept here so both server and client
 * components can import it without pulling in DB types.
 */

export type RunStatus = "running" | "awaiting_human" | "completed" | "failed";
export type StepStatus = "pending" | "running" | "awaiting_human" | "completed" | "failed";
export type StepType = "auto" | "human";

export interface RunDto {
  id: string;
  status: RunStatus;
  processDefinitionId: string;
  input: unknown;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface StepDto {
  id: string;
  definitionStepId: string;
  stepIndex: number;
  type: StepType;
  adapter: string;
  title: string;
  status: StepStatus;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface RunPayload {
  run: RunDto;
  steps: StepDto[];
}

export interface LeadFields {
  company: string;
  contact: string;
  role: string;
  ask: string;
  signals: string[];
  source: string;
}

export interface QualifyResult {
  score: 1 | 2 | 3 | 4 | 5;
  recommendedAction: string;
  rationale: string;
}

export interface DraftReply {
  subject: string;
  body: string;
}

/**
 * Step adapters. Pure functions of (input, context) → output. The engine
 * persists their results; adapters do not touch the database directly.
 *
 * The LLM-backed steps dispatch to a runtime-selected implementation:
 *
 *   LLM_ADAPTER=fixture   (default) — deterministic in-process implementation
 *                                     used by tests and offline development.
 *   LLM_ADAPTER=anthropic            — calls the real Claude API via
 *                                     @anthropic-ai/sdk. Requires
 *                                     ANTHROPIC_API_KEY; the adapter throws
 *                                     fast on the first LLM step if missing.
 */

import { anthropicLlmAdapter } from "./llm/anthropic";
import { fixtureLlmAdapter } from "./llm/fixture";

export interface AdapterContext {
  runId: string;
  stepId: string;
  runInput: unknown;
}

export type AdapterFn = (
  input: unknown,
  context: AdapterContext,
) => Promise<Record<string, unknown>>;

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

export interface Draft {
  subject: string;
  body: string;
}

export interface LlmAdapter {
  extract(rawText: string): Promise<LeadFields>;
  qualify(fields: LeadFields): Promise<QualifyResult>;
  draftReply(fields: LeadFields, qualification: QualifyResult): Promise<Draft>;
}

export type LlmAdapterChoice = "fixture" | "anthropic";

export function resolveLlmAdapter(): LlmAdapter {
  const choice = (process.env.LLM_ADAPTER ?? "fixture") as LlmAdapterChoice;
  if (choice === "anthropic") return anthropicLlmAdapter;
  if (choice === "fixture") return fixtureLlmAdapter;
  throw new Error(`Unsupported LLM_ADAPTER value "${choice}". Expected "fixture" or "anthropic".`);
}

export { fixtureExtract } from "./llm/fixture";

export const adapters: Record<string, AdapterFn> = {
  "llm.extract_lead_fields": async (_input, context) => {
    const rawText = readRawText(context.runInput);
    const fields = await resolveLlmAdapter().extract(rawText);
    return { fields };
  },
  "llm.qualify_lead": async (input) => {
    const fields = (input as { fields?: LeadFields })?.fields;
    if (!fields) throw new Error("qualify step missing 'fields' in input");
    const qualification = await resolveLlmAdapter().qualify(fields);
    return { qualification };
  },
  "llm.draft_reply": async (input) => {
    const i = input as { fields?: LeadFields; qualification?: QualifyResult };
    if (!i.fields || !i.qualification) {
      throw new Error("draft step missing 'fields' or 'qualification' in input");
    }
    const draft = await resolveLlmAdapter().draftReply(i.fields, i.qualification);
    return { draft };
  },
  "human.gate": async (input) => {
    // Human gate does not produce its own output; the operator's edited
    // payload becomes the step output via the approve endpoint.
    return { awaitingHumanInput: true, suggested: input ?? null };
  },
  "dispatch.mock": async (input) => {
    const draft = (input as { draft?: Draft })?.draft;
    if (!draft) throw new Error("dispatch step missing 'draft' in input");
    return {
      dispatched: true,
      to: "<mocked-recipient>",
      subject: draft.subject,
      body: draft.body,
      sentAt: new Date().toISOString(),
    };
  },
};

function readRawText(runInput: unknown): string {
  if (
    runInput &&
    typeof runInput === "object" &&
    "rawText" in runInput &&
    typeof (runInput as { rawText: unknown }).rawText === "string"
  ) {
    return (runInput as { rawText: string }).rawText;
  }
  throw new Error("Run input must be an object with a string `rawText` field.");
}

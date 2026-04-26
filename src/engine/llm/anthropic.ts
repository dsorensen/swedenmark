/**
 * Real Anthropic Claude implementation of the LLM steps used by the
 * lead-qualification process. Selected at runtime when LLM_ADAPTER=anthropic.
 *
 * Defaults:
 *   - extract / draft  → claude-sonnet-4-6 (good structured output, fast)
 *   - qualify          → claude-haiku-4-5  (cheap classifier)
 *
 * Each call uses structured outputs (`output_config.format` + Zod schema) so
 * the parsed payload matches the same TypeScript types the fixture adapter
 * returns. The few-shot fixtures live in
 * `src/processes/lead-qualification/prompts` so prompt iteration shows up
 * in code review.
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import {
  draftPrompt,
  extractPrompt,
  qualifyPrompt,
} from "../../processes/lead-qualification/prompts";
import type { Draft, LeadFields, LlmAdapter, QualifyResult } from "../adapters";

const EXTRACT_MODEL = "claude-sonnet-4-6";
const QUALIFY_MODEL = "claude-haiku-4-5";
const DRAFT_MODEL = "claude-sonnet-4-6";

const LeadFieldsSchema = z.object({
  company: z.string(),
  contact: z.string(),
  role: z.string(),
  ask: z.string(),
  signals: z.array(z.string()),
  source: z.string(),
});

const QualifySchema = z.object({
  score: z.number().int().min(1).max(5),
  recommendedAction: z.string(),
  rationale: z.string(),
});

const DraftSchema = z.object({
  subject: z.string(),
  body: z.string(),
});

let cachedClient: Anthropic | null = null;

function client(): Anthropic {
  if (cachedClient) return cachedClient;
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("LLM_ADAPTER=anthropic requires ANTHROPIC_API_KEY in the environment.");
  }
  cachedClient = new Anthropic();
  return cachedClient;
}

function fewShotMessages<TIn, TOut>(
  shots: { input: TIn; output: TOut }[],
  serializeInput: (input: TIn) => string,
) {
  return shots.flatMap(({ input, output }) => [
    { role: "user" as const, content: serializeInput(input) },
    { role: "assistant" as const, content: JSON.stringify(output) },
  ]);
}

export const anthropicLlmAdapter: LlmAdapter = {
  async extract(rawText) {
    const response = await client().messages.parse({
      model: EXTRACT_MODEL,
      max_tokens: 1024,
      system: extractPrompt.system,
      messages: [
        ...fewShotMessages(extractPrompt.fewShots, (input) => input),
        { role: "user", content: rawText },
      ],
      output_config: { format: zodOutputFormat(LeadFieldsSchema) },
    });
    const parsed = response.parsed_output;
    if (!parsed) throw new Error("Anthropic extract returned no parsed output");
    return parsed satisfies LeadFields;
  },

  async qualify(fields) {
    const response = await client().messages.parse({
      model: QUALIFY_MODEL,
      max_tokens: 512,
      system: qualifyPrompt.system,
      messages: [
        ...fewShotMessages(qualifyPrompt.fewShots, (input) => JSON.stringify(input)),
        { role: "user", content: JSON.stringify(fields) },
      ],
      output_config: { format: zodOutputFormat(QualifySchema) },
    });
    const parsed = response.parsed_output;
    if (!parsed) throw new Error("Anthropic qualify returned no parsed output");
    return parsed as QualifyResult;
  },

  async draftReply(fields, qualification) {
    const response = await client().messages.parse({
      model: DRAFT_MODEL,
      max_tokens: 1024,
      system: draftPrompt.system,
      messages: [
        ...fewShotMessages(draftPrompt.fewShots, (input) => JSON.stringify(input)),
        { role: "user", content: JSON.stringify({ fields, qualification }) },
      ],
      output_config: { format: zodOutputFormat(DraftSchema) },
    });
    const parsed = response.parsed_output;
    if (!parsed) throw new Error("Anthropic draft returned no parsed output");
    return parsed satisfies Draft;
  },
};

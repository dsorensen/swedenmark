import { describe, expect, it } from "vitest";
import { z } from "zod";
import { fixtureLlmAdapter } from "../../src/engine/llm/fixture";
import {
  draftPrompt,
  extractPrompt,
  qualifyPrompt,
} from "../../src/processes/lead-qualification/prompts";

const LeadFieldsSchema = z.object({
  company: z.string().min(1),
  contact: z.string().min(1),
  role: z.string().min(1),
  ask: z.string().min(1),
  signals: z.array(z.string()),
  source: z.enum(["linkedin", "web_form", "email"]),
});

const QualifySchema = z.object({
  score: z.number().int().min(1).max(5),
  recommendedAction: z.string().min(1),
  rationale: z.string().min(1),
});

const DraftSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
});

describe("lead-qualification prompts", () => {
  it("extract few-shots match the LeadFields schema", () => {
    for (const shot of extractPrompt.fewShots) {
      expect(() => LeadFieldsSchema.parse(shot.output)).not.toThrow();
    }
  });

  it("qualify few-shots match the Qualification schema", () => {
    for (const shot of qualifyPrompt.fewShots) {
      expect(() => LeadFieldsSchema.parse(shot.input)).not.toThrow();
      expect(() => QualifySchema.parse(shot.output)).not.toThrow();
    }
  });

  it("draft few-shots match the Draft schema", () => {
    for (const shot of draftPrompt.fewShots) {
      expect(() => LeadFieldsSchema.parse(shot.input.fields)).not.toThrow();
      expect(() => QualifySchema.parse(shot.input.qualification)).not.toThrow();
      expect(() => DraftSchema.parse(shot.output)).not.toThrow();
    }
  });

  it("the fixture adapter produces schema-valid outputs for every extract few-shot", async () => {
    for (const shot of extractPrompt.fewShots) {
      const fields = await fixtureLlmAdapter.extract(shot.input);
      expect(() => LeadFieldsSchema.parse(fields)).not.toThrow();
    }
  });

  it("the fixture adapter produces schema-valid outputs for every qualify few-shot", async () => {
    for (const shot of qualifyPrompt.fewShots) {
      const qualification = await fixtureLlmAdapter.qualify(shot.input);
      expect(() => QualifySchema.parse(qualification)).not.toThrow();
    }
  });

  it("the fixture adapter produces schema-valid outputs for every draft few-shot", async () => {
    for (const shot of draftPrompt.fewShots) {
      const draft = await fixtureLlmAdapter.draftReply(shot.input.fields, shot.input.qualification);
      expect(() => DraftSchema.parse(draft)).not.toThrow();
    }
  });
});

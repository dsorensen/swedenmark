import type { ProcessDefinitionSpec } from "../types";

export const LEAD_QUALIFICATION_SLUG = "lead-qualification";

export const leadQualificationProcess: ProcessDefinitionSpec = {
  slug: LEAD_QUALIFICATION_SLUG,
  title: "Inbound lead qualification → drafted reply",
  version: 1,
  steps: [
    {
      id: "extract",
      type: "auto",
      adapter: "llm.extract_lead_fields",
      title: "Extract structured lead fields",
      promptKey: "lead-qualification/extract",
    },
    {
      id: "qualify",
      type: "auto",
      adapter: "llm.qualify_lead",
      title: "Score fit and recommend next action",
      promptKey: "lead-qualification/qualify",
    },
    {
      id: "review_qualification",
      type: "human",
      adapter: "human.gate",
      title: "Operator review of structured fields and score",
    },
    {
      id: "draft_reply",
      type: "auto",
      adapter: "llm.draft_reply",
      title: "Draft reply email",
      promptKey: "lead-qualification/draft",
    },
    {
      id: "approve_reply",
      type: "human",
      adapter: "human.gate",
      title: "Operator approval of reply",
    },
    {
      id: "dispatch",
      type: "auto",
      adapter: "dispatch.mock",
      title: "Record dispatch (mocked send)",
    },
  ],
};

/**
 * Drives the lead-qualification adapters end-to-end with a real inbound
 * message and prints the JSON each step produces. This bypasses Postgres
 * (the engine's persistence layer) and exercises the same pure adapter
 * functions that the production engine calls. Used to capture artifacts
 * for the SWE-6 written walkthrough.
 */
import { adapters } from "../src/engine/adapters";
import { leadQualificationProcess } from "../src/processes/lead-qualification";

const SAMPLE_INBOUND = `Hi, I'm Maya Chen, CTO at Northwind Logistics. Saw your demo on LinkedIn.
We're a team of 40 evaluating ways to automate inbound RFP triage and want pricing for a pilot this week.`;

interface StepRecord {
  id: string;
  type: "auto" | "human";
  status: "completed" | "awaiting_human";
  input: unknown;
  output: unknown;
  note?: string;
}

async function main() {
  const runInput = { rawText: SAMPLE_INBOUND };
  const records: StepRecord[] = [];

  let extractOut: Record<string, unknown> = {};
  let qualifyOut: Record<string, unknown> = {};
  let reviewedOut: Record<string, unknown> = {};
  let draftOut: Record<string, unknown> = {};
  let approvedReplyOut: Record<string, unknown> = {};

  for (const step of leadQualificationProcess.steps) {
    const ctx = { runId: "demo-run", stepId: step.id, runInput };

    if (step.id === "extract") {
      const out = await adapters[step.adapter](runInput, ctx);
      extractOut = out;
      records.push({
        id: step.id,
        type: "auto",
        status: "completed",
        input: runInput,
        output: out,
      });
    } else if (step.id === "qualify") {
      const out = await adapters[step.adapter](extractOut, ctx);
      qualifyOut = out;
      records.push({
        id: step.id,
        type: "auto",
        status: "completed",
        input: extractOut,
        output: out,
      });
    } else if (step.id === "review_qualification") {
      const suggested = { ...extractOut, ...qualifyOut };
      // Operator edits one field at the gate (matches integration-test behaviour).
      const editedFields = {
        ...(extractOut.fields as Record<string, unknown>),
        contact: "Maya Chen (verified)",
      };
      reviewedOut = { fields: editedFields, qualification: qualifyOut.qualification };
      records.push({
        id: step.id,
        type: "human",
        status: "awaiting_human",
        input: suggested,
        output: reviewedOut,
        note: "Operator edited `contact` then approved.",
      });
    } else if (step.id === "draft_reply") {
      const out = await adapters[step.adapter](reviewedOut, ctx);
      draftOut = out;
      records.push({
        id: step.id,
        type: "auto",
        status: "completed",
        input: reviewedOut,
        output: out,
      });
    } else if (step.id === "approve_reply") {
      // No edits — operator accepts the suggested draft.
      approvedReplyOut = draftOut;
      records.push({
        id: step.id,
        type: "human",
        status: "awaiting_human",
        input: draftOut,
        output: approvedReplyOut,
        note: "Operator accepted draft without edits.",
      });
    } else if (step.id === "dispatch") {
      const out = await adapters[step.adapter](approvedReplyOut, ctx);
      records.push({
        id: step.id,
        type: "auto",
        status: "completed",
        input: approvedReplyOut,
        output: out,
      });
    }
  }

  console.log(JSON.stringify({ runInput, steps: records, finalStatus: "completed" }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

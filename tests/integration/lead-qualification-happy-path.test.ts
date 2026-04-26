import { afterAll, beforeAll, expect, it } from "vitest";
import { handleApproveStep, handleCreateRun, handleGetRun } from "../../src/api/handlers";
import { describeIntegration, resetDb, teardownDb } from "./setup";

interface RunPayload {
  run: { id: string; status: string };
  steps: Array<{
    id: string;
    definitionStepId: string;
    type: string;
    status: string;
    input: Record<string, unknown> | null;
    output: Record<string, unknown> | null;
  }>;
}

const SAMPLE_INBOUND = `Hi, I'm Maya Chen, CTO at Northwind Logistics. Saw your demo on LinkedIn.
We're a team of 40 evaluating ways to automate inbound RFP triage and want pricing for a pilot this week.`;

describeIntegration("lead-qualification happy path", () => {
  beforeAll(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await teardownDb();
  });

  it("walks the full operator journey end-to-end against Postgres", async () => {
    // 1. Create the run with raw inbound text.
    const created = await handleCreateRun({
      processSlug: "lead-qualification",
      input: { rawText: SAMPLE_INBOUND },
    });
    expect(created.status).toBe(201);
    const r1 = created.body as RunPayload;

    // After auto extract+qualify, run should pause at first human gate.
    expect(r1.run.status).toBe("awaiting_human");
    const reviewStep = r1.steps.find((s) => s.definitionStepId === "review_qualification");
    expect(reviewStep).toBeDefined();
    expect(reviewStep?.status).toBe("awaiting_human");
    // The gate sees aggregate output from prior auto steps.
    expect(reviewStep?.input).toMatchObject({
      fields: { company: expect.any(String), contact: expect.any(String) },
      qualification: { score: expect.any(Number), recommendedAction: expect.any(String) },
    });

    const extractStep = r1.steps.find((s) => s.definitionStepId === "extract");
    expect(extractStep?.status).toBe("completed");
    expect(extractStep?.output).toMatchObject({
      fields: { company: expect.any(String), source: expect.any(String) },
    });

    // 2. Operator approves the qualification gate, editing one field.
    if (!reviewStep) throw new Error("review step missing");
    const editedFields = {
      ...((reviewStep.input as { fields: Record<string, unknown> }).fields ?? {}),
      contact: "Maya Chen (verified)",
    };
    const editedQualification = (reviewStep.input as { qualification: Record<string, unknown> })
      .qualification;
    const approveQualified = await handleApproveStep(r1.run.id, reviewStep.id, {
      output: { fields: editedFields, qualification: editedQualification },
      edited: true,
    });
    expect(approveQualified.status).toBe(200);
    const r2 = approveQualified.body as RunPayload;

    // After approval, draft_reply runs and we pause at approve_reply gate.
    expect(r2.run.status).toBe("awaiting_human");
    const draftStep = r2.steps.find((s) => s.definitionStepId === "draft_reply");
    expect(draftStep?.status).toBe("completed");
    expect(draftStep?.output).toMatchObject({
      draft: { subject: expect.any(String), body: expect.any(String) },
    });
    const approveReplyStep = r2.steps.find((s) => s.definitionStepId === "approve_reply");
    expect(approveReplyStep?.status).toBe("awaiting_human");

    // 3. Operator approves the reply (no edits — accept suggested draft).
    if (!approveReplyStep) throw new Error("approve_reply step missing");
    const finalize = await handleApproveStep(r2.run.id, approveReplyStep.id, {});
    expect(finalize.status).toBe(200);
    const r3 = finalize.body as RunPayload;

    expect(r3.run.status).toBe("completed");
    const dispatchStep = r3.steps.find((s) => s.definitionStepId === "dispatch");
    expect(dispatchStep?.status).toBe("completed");
    expect(dispatchStep?.output).toMatchObject({
      dispatched: true,
      subject: expect.any(String),
      body: expect.any(String),
    });

    // 4. GET reflects the final state.
    const fetched = await handleGetRun(r3.run.id);
    expect(fetched.status).toBe(200);
    const fetchedBody = fetched.body as RunPayload;
    expect(fetchedBody.run.status).toBe("completed");
    expect(fetchedBody.steps.every((s) => s.status === "completed")).toBe(true);
  });

  it("rejects approving a non-human-gate step", async () => {
    const created = await handleCreateRun({
      processSlug: "lead-qualification",
      input: { rawText: SAMPLE_INBOUND },
    });
    const body = created.body as RunPayload;
    const extractStep = body.steps.find((s) => s.definitionStepId === "extract");
    if (!extractStep) throw new Error("extract step missing");
    const result = await handleApproveStep(body.run.id, extractStep.id, {});
    expect(result.status).toBe(400);
    expect((result.body as { error: { code: string } }).error.code).toBe("step_not_human_gate");
  });

  it("returns 404 for unknown run", async () => {
    const result = await handleGetRun("00000000-0000-0000-0000-000000000000");
    expect(result.status).toBe(404);
  });
});

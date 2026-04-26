import { handleGetRun } from "@/src/api/handlers";
import type {
  DraftReply,
  LeadFields,
  QualifyResult,
  RunPayload,
  StepDto,
} from "@/src/ui/run-types";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApproveQualificationForm } from "./ApproveQualificationForm";
import { ApproveReplyForm } from "./ApproveReplyForm";

export const dynamic = "force-dynamic";

export default async function RunViewerPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const result = await handleGetRun(runId);
  if (result.status === 404) notFound();
  if (result.status !== 200) {
    throw new Error(`Failed to load run: status ${result.status}`);
  }
  const { run, steps } = result.body as RunPayload;

  const rawText =
    typeof run.input === "object" && run.input && "rawText" in (run.input as object)
      ? String((run.input as { rawText: unknown }).rawText ?? "")
      : "";

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <nav className="mb-6 flex items-center gap-3 text-sm text-neutral-600">
        <Link href="/" className="underline-offset-4 hover:underline">
          ← New run
        </Link>
        <span aria-hidden>/</span>
        <Link href="/runs" className="underline-offset-4 hover:underline">
          History
        </Link>
      </nav>

      <header className="mb-8 flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Run {run.id.slice(0, 8)}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Started {new Date(run.createdAt).toLocaleString()}
          </p>
        </div>
        <RunStatusBadge status={run.status} />
      </header>

      {run.error ? (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Run failed: {run.error}
        </div>
      ) : null}

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wider text-neutral-500">
          Inbound message
        </h2>
        <pre
          data-testid="raw-input"
          className="whitespace-pre-wrap rounded-md border border-neutral-200 bg-neutral-50 p-3 font-mono text-sm text-neutral-800"
        >
          {rawText}
        </pre>
      </section>

      <ol className="space-y-4">
        {steps.map((step) => (
          <li key={step.id}>
            <StepCard runId={run.id} step={step} />
          </li>
        ))}
      </ol>
    </main>
  );
}

function StepCard({ runId, step }: { runId: string; step: StepDto }) {
  const isActiveGate = step.status === "awaiting_human";
  return (
    <article
      data-testid={`step-${step.definitionStepId}`}
      data-status={step.status}
      className={`rounded-lg border p-5 ${
        isActiveGate ? "border-amber-300 bg-amber-50" : "border-neutral-200 bg-white"
      }`}
    >
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <h3 className="text-base font-medium">
            <span className="mr-2 text-neutral-400">#{step.stepIndex + 1}</span>
            {step.title}
          </h3>
          <p className="mt-0.5 text-xs text-neutral-500">
            {step.type === "human" ? "Human gate" : "Auto step"} · {step.adapter}
          </p>
        </div>
        <StepStatusBadge status={step.status} />
      </header>

      <StepBody runId={runId} step={step} />
    </article>
  );
}

function StepBody({ runId, step }: { runId: string; step: StepDto }) {
  if (step.status === "pending" || step.status === "running") {
    return <p className="text-sm text-neutral-500">Waiting for upstream steps…</p>;
  }

  if (step.definitionStepId === "review_qualification" && step.status === "awaiting_human") {
    const input = step.input as { fields?: LeadFields; qualification?: QualifyResult } | null;
    if (!input?.fields || !input.qualification) {
      return <p className="text-sm text-red-600">Gate input missing.</p>;
    }
    return (
      <ApproveQualificationForm
        runId={runId}
        stepId={step.id}
        initialFields={input.fields}
        initialQualification={input.qualification}
      />
    );
  }

  if (step.definitionStepId === "approve_reply" && step.status === "awaiting_human") {
    const input = step.input as { draft?: DraftReply } | null;
    if (!input?.draft) {
      return <p className="text-sm text-red-600">Gate input missing.</p>;
    }
    return <ApproveReplyForm runId={runId} stepId={step.id} initialDraft={input.draft} />;
  }

  if (step.status === "failed") {
    return <p className="text-sm text-red-700">Step failed: {step.error ?? "unknown error"}</p>;
  }

  // Completed step — render its output.
  return <CompletedStepOutput step={step} />;
}

function CompletedStepOutput({ step }: { step: StepDto }) {
  const output = step.output ?? {};
  if (step.definitionStepId === "extract" && hasFields(output)) {
    return <FieldsView fields={output.fields} />;
  }
  if (step.definitionStepId === "qualify" && hasQualification(output)) {
    return <QualificationView qualification={output.qualification} />;
  }
  if (step.definitionStepId === "review_qualification") {
    if (hasFields(output) && hasQualification(output)) {
      return (
        <div className="space-y-3">
          <FieldsView fields={output.fields} />
          <QualificationView qualification={output.qualification} />
          <p className="text-xs text-neutral-500">Approved by operator.</p>
        </div>
      );
    }
  }
  if (step.definitionStepId === "draft_reply" && hasDraft(output)) {
    return <DraftView draft={output.draft} />;
  }
  if (step.definitionStepId === "approve_reply" && hasDraft(output)) {
    return (
      <div className="space-y-2">
        <DraftView draft={output.draft} />
        <p className="text-xs text-neutral-500">Approved by operator.</p>
      </div>
    );
  }
  if (step.definitionStepId === "dispatch") {
    const subject = String((output as { subject?: unknown }).subject ?? "");
    const body = String((output as { body?: unknown }).body ?? "");
    const sentAt = String((output as { sentAt?: unknown }).sentAt ?? "");
    return (
      <div className="space-y-2">
        <p
          data-testid="dispatch-confirmation"
          className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          Reply dispatched (mock) at {sentAt ? new Date(sentAt).toLocaleString() : "unknown time"}.
        </p>
        <DraftView draft={{ subject, body }} />
      </div>
    );
  }
  return <JsonView value={output} />;
}

function hasFields(o: Record<string, unknown>): o is { fields: LeadFields } {
  return !!o.fields && typeof o.fields === "object";
}
function hasQualification(o: Record<string, unknown>): o is { qualification: QualifyResult } {
  return !!o.qualification && typeof o.qualification === "object";
}
function hasDraft(o: Record<string, unknown>): o is { draft: DraftReply } {
  return !!o.draft && typeof o.draft === "object";
}

function FieldsView({ fields }: { fields: LeadFields }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      <Row label="Company" value={fields.company} />
      <Row label="Contact" value={fields.contact} />
      <Row label="Role" value={fields.role} />
      <Row label="Source" value={fields.source} />
      <Row label="Signals" value={fields.signals?.length ? fields.signals.join(", ") : "—"} />
      <Row label="Ask" value={fields.ask} className="sm:col-span-2" />
    </dl>
  );
}

function QualificationView({ qualification }: { qualification: QualifyResult }) {
  return (
    <div className="mt-2 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium">Fit score</span>
        <span className="rounded bg-neutral-900 px-2 py-0.5 font-mono text-xs text-white">
          {qualification.score}/5
        </span>
      </div>
      <p className="mt-2">
        <span className="font-medium">Recommended action: </span>
        {qualification.recommendedAction}
      </p>
      <p className="mt-1 text-neutral-600">{qualification.rationale}</p>
    </div>
  );
}

function DraftView({ draft }: { draft: DraftReply }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white text-sm">
      <div className="border-b border-neutral-200 px-3 py-2">
        <span className="font-medium text-neutral-500">Subject: </span>
        <span>{draft.subject}</span>
      </div>
      <pre className="whitespace-pre-wrap px-3 py-2 font-mono text-sm text-neutral-800">
        {draft.body}
      </pre>
    </div>
  );
}

function Row({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs uppercase tracking-wider text-neutral-500">{label}</dt>
      <dd className="text-neutral-900">{value || "—"}</dd>
    </div>
  );
}

function JsonView({ value }: { value: unknown }) {
  return (
    <pre className="overflow-x-auto rounded-md bg-neutral-50 p-3 font-mono text-xs text-neutral-700">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function RunStatusBadge({ status }: { status: RunPayload["run"]["status"] }) {
  const map: Record<RunPayload["run"]["status"], string> = {
    running: "bg-blue-100 text-blue-800",
    awaiting_human: "bg-amber-100 text-amber-800",
    completed: "bg-emerald-100 text-emerald-800",
    failed: "bg-red-100 text-red-800",
  };
  return (
    <span
      data-testid="run-status"
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${map[status]}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function StepStatusBadge({ status }: { status: StepDto["status"] }) {
  const map: Record<StepDto["status"], string> = {
    pending: "bg-neutral-100 text-neutral-600",
    running: "bg-blue-100 text-blue-800",
    awaiting_human: "bg-amber-100 text-amber-800",
    completed: "bg-emerald-100 text-emerald-800",
    failed: "bg-red-100 text-red-800",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${map[status]}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

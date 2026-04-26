"use client";

import type { LeadFields, QualifyResult } from "@/src/ui/run-types";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface Props {
  runId: string;
  stepId: string;
  initialFields: LeadFields;
  initialQualification: QualifyResult;
}

export function ApproveQualificationForm({
  runId,
  stepId,
  initialFields,
  initialQualification,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [company, setCompany] = useState(initialFields.company);
  const [contact, setContact] = useState(initialFields.contact);
  const [role, setRole] = useState(initialFields.role);
  const [ask, setAsk] = useState(initialFields.ask);
  const [signals, setSignals] = useState((initialFields.signals ?? []).join(", "));
  const [source, setSource] = useState(initialFields.source);

  const [score, setScore] = useState<QualifyResult["score"]>(initialQualification.score);
  const [recommendedAction, setRecommendedAction] = useState(
    initialQualification.recommendedAction,
  );
  const [rationale, setRationale] = useState(initialQualification.rationale);

  function edited(): boolean {
    return (
      company !== initialFields.company ||
      contact !== initialFields.contact ||
      role !== initialFields.role ||
      ask !== initialFields.ask ||
      signals !== (initialFields.signals ?? []).join(", ") ||
      source !== initialFields.source ||
      score !== initialQualification.score ||
      recommendedAction !== initialQualification.recommendedAction ||
      rationale !== initialQualification.rationale
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const fields: LeadFields = {
      company,
      contact,
      role,
      ask,
      signals: signals
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      source,
    };
    const qualification: QualifyResult = { score, recommendedAction, rationale };
    try {
      const res = await fetch(`/api/runs/${runId}/steps/${stepId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          output: { fields, qualification },
          edited: edited(),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { code?: string; message?: string };
        } | null;
        throw new Error(body?.error?.message ?? `Request failed with ${res.status}`);
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  const busy = submitting || pending;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-neutral-700">
        Review and edit the extracted fields and recommendation, then approve to continue.
      </p>

      <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2" disabled={busy}>
        <Field label="Company" name="company" value={company} onChange={setCompany} />
        <Field label="Contact" name="contact" value={contact} onChange={setContact} />
        <Field label="Role" name="role" value={role} onChange={setRole} />
        <Field label="Source" name="source" value={source} onChange={setSource} />
        <Field
          label="Signals (comma-separated)"
          name="signals"
          value={signals}
          onChange={setSignals}
          className="sm:col-span-2"
        />
        <TextArea label="Ask" name="ask" value={ask} onChange={setAsk} className="sm:col-span-2" />
      </fieldset>

      <fieldset
        className="space-y-3 rounded-md border border-neutral-200 bg-white p-3"
        disabled={busy}
      >
        <legend className="px-1 text-xs uppercase tracking-wider text-neutral-500">
          Qualification
        </legend>
        <label className="block text-sm font-medium">
          Fit score
          <select
            name="score"
            value={score}
            onChange={(e) => setScore(Number(e.target.value) as QualifyResult["score"])}
            className="ml-2 rounded-md border border-neutral-300 px-2 py-1 text-sm"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <TextArea
          label="Recommended action"
          name="recommendedAction"
          value={recommendedAction}
          onChange={setRecommendedAction}
        />
        <TextArea label="Rationale" name="rationale" value={rationale} onChange={setRationale} />
      </fieldset>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={busy}
          data-testid="approve-qualification"
          className="inline-flex items-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
        >
          {busy ? "Approving…" : "Approve & continue"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  className = "",
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="text-xs uppercase tracking-wider text-neutral-500">{label}</span>
      <input
        type="text"
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-md border border-neutral-300 px-2 py-1 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
      />
    </label>
  );
}

function TextArea({
  label,
  name,
  value,
  onChange,
  className = "",
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="text-xs uppercase tracking-wider text-neutral-500">{label}</span>
      <textarea
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="mt-1 block w-full rounded-md border border-neutral-300 px-2 py-1 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
      />
    </label>
  );
}

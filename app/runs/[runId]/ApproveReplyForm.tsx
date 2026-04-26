"use client";

import type { DraftReply } from "@/src/ui/run-types";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface Props {
  runId: string;
  stepId: string;
  initialDraft: DraftReply;
}

export function ApproveReplyForm({ runId, stepId, initialDraft }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [subject, setSubject] = useState(initialDraft.subject);
  const [body, setBody] = useState(initialDraft.body);

  const edited = subject !== initialDraft.subject || body !== initialDraft.body;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/runs/${runId}/steps/${stepId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          output: { draft: { subject, body } },
          edited,
        }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(errBody?.error?.message ?? `Request failed with ${res.status}`);
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
        Review the draft. Edit inline if needed, then send.
      </p>
      <label className="block text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-500">Subject</span>
        <input
          type="text"
          name="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          disabled={busy}
          className="mt-1 block w-full rounded-md border border-neutral-300 px-2 py-1 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
        />
      </label>
      <label className="block text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-500">Body</span>
        <textarea
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          disabled={busy}
          className="mt-1 block w-full rounded-md border border-neutral-300 px-2 py-1 font-mono text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
        />
      </label>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={busy}
          data-testid="approve-reply"
          className="inline-flex items-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
        >
          {busy ? "Sending…" : "Send"}
        </button>
      </div>
    </form>
  );
}

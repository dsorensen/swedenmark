import { handleCreateRun } from "@/src/api/handlers";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const SAMPLE = `Hi, I'm Maya Chen, CTO at Northwind Logistics. Saw your demo on LinkedIn.
We're a team of 40 evaluating ways to automate inbound RFP triage and want pricing for a pilot this week.`;

async function createRunAction(formData: FormData) {
  "use server";
  const rawText = String(formData.get("rawText") ?? "").trim();
  if (!rawText) {
    redirect("/?error=empty");
  }
  const result = await handleCreateRun({
    processSlug: "lead-qualification",
    input: { rawText },
  });
  if (result.status !== 201) {
    const code =
      (result.body as { error?: { code?: string } } | undefined)?.error?.code ?? "unknown";
    redirect(`/?error=${encodeURIComponent(code)}`);
  }
  const runId = (result.body as { run: { id: string } }).run.id;
  redirect(`/runs/${runId}`);
}

export default async function IntakePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New lead intake</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Paste an inbound message. The system will extract structured fields, score fit, and
            pause for your review at each gate.
          </p>
        </div>
        <Link href="/runs" className="text-sm text-neutral-600 underline-offset-4 hover:underline">
          Run history →
        </Link>
      </header>

      {error ? (
        <div
          className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          Could not start a run ({error}). Try again.
        </div>
      ) : null}

      <form action={createRunAction} className="space-y-4">
        <label htmlFor="rawText" className="block text-sm font-medium">
          Inbound message
        </label>
        <textarea
          id="rawText"
          name="rawText"
          required
          rows={12}
          defaultValue={SAMPLE}
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
          placeholder="Paste raw inbound email, form submission, or DM..."
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-neutral-500">
            Tip: edit the sample text or replace it with a real message.
          </p>
          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2"
          >
            Run
          </button>
        </div>
      </form>
    </main>
  );
}

import { getDb, schema } from "@/src/db/client";
import { desc } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface RunRow {
  id: string;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
  input: unknown;
}

async function listRuns(): Promise<RunRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.processRun.id,
      status: schema.processRun.status,
      createdAt: schema.processRun.createdAt,
      completedAt: schema.processRun.completedAt,
      input: schema.processRun.input,
    })
    .from(schema.processRun)
    .orderBy(desc(schema.processRun.createdAt))
    .limit(50);
  return rows;
}

function previewText(input: unknown): string {
  if (
    input &&
    typeof input === "object" &&
    "rawText" in input &&
    typeof (input as { rawText: unknown }).rawText === "string"
  ) {
    const t = (input as { rawText: string }).rawText.trim().replace(/\s+/g, " ");
    return t.length > 120 ? `${t.slice(0, 117)}…` : t;
  }
  return "(no preview)";
}

export default async function RunsPage() {
  const runs = await listRuns();
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Run history</h1>
        <Link href="/" className="text-sm text-neutral-700 underline-offset-4 hover:underline">
          + New run
        </Link>
      </header>

      {runs.length === 0 ? (
        <p className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-sm text-neutral-500">
          No runs yet. Start one from the{" "}
          <Link href="/" className="underline">
            intake page
          </Link>
          .
        </p>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
          {runs.map((run) => (
            <li key={run.id}>
              <Link
                href={`/runs/${run.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-neutral-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-sm">{run.id.slice(0, 8)}</span>
                    <StatusBadge status={run.status} />
                  </div>
                  <p className="truncate text-sm text-neutral-600">{previewText(run.input)}</p>
                </div>
                <div className="shrink-0 text-right text-xs text-neutral-500">
                  <div>{new Date(run.createdAt).toLocaleString()}</div>
                  {run.completedAt ? (
                    <div className="mt-0.5 text-emerald-700">
                      done {new Date(run.completedAt).toLocaleTimeString()}
                    </div>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    running: "bg-blue-100 text-blue-800",
    awaiting_human: "bg-amber-100 text-amber-800",
    completed: "bg-emerald-100 text-emerald-800",
    failed: "bg-red-100 text-red-800",
  };
  const cls = map[status] ?? "bg-neutral-100 text-neutral-700";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

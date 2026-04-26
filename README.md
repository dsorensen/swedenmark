# Swedenmark

Internal product. v1 vertical slice: turn an unstructured business process into structured artifacts and a recommended next action, with a human in the loop at every gate.

See the v1 design doc on the engineering kickoff issue for the product and architecture rationale.

## Stack

- **Runtime:** TypeScript on Next.js 15 (App Router) — UI + API in one repo, one deploy
- **UI:** React 19 + Tailwind v4
- **Datastore:** Postgres + Drizzle ORM
- **LLM:** Anthropic Claude (real adapter wired in a follow-up; v1 backend uses a deterministic in-process fixture adapter)
- **Tests:** Vitest (unit + integration); Playwright is added in SWE-5
- **Lint/format:** Biome
- **CI:** GitHub Actions (with a Postgres service container)

## Onboarding (under 5 minutes)

Prereqs: Node 20.11+, pnpm 9, and either Docker (recommended) or a local Postgres 16.

```bash
git clone git@github.com:dsorensen/swedenmark.git
cd swedenmark
pnpm install
cp .env.example .env.local
pnpm dev:up        # starts Postgres in Docker, runs migrations + seed, then `next dev`
```

Open http://localhost:3000.

If you prefer to manage Postgres yourself, point `DATABASE_URL` in `.env.local` at any
empty Postgres database, then run `pnpm db:migrate && pnpm db:seed && pnpm dev`.

## Common scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Run the app (assumes DB is already up + migrated) |
| `pnpm dev:up` | Start Docker Postgres, migrate, seed, then `pnpm dev` — the one-command path |
| `pnpm db:up` / `pnpm db:down` | Start / stop the local Postgres container |
| `pnpm db:migrate` | Apply Drizzle migrations against `DATABASE_URL` |
| `pnpm db:seed` | Insert / refresh the lead-qualification process definition |
| `pnpm db:generate` | Generate a new Drizzle migration from `src/db/schema.ts` |
| `pnpm build` / `pnpm start` | Production build / start |
| `pnpm lint` / `pnpm lint:fix` / `pnpm format` | Biome |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` / `pnpm test:watch` | Vitest (unit + integration) |
| `pnpm test:e2e` | Playwright happy-path against a built Next.js server |
| `pnpm verify` | Lint + typecheck + test + build (matches CI) |

## Backend skeleton (SWE-4)

The v1 backend is a small process engine + REST surface, all in this Next.js repo.

### Process model

A `process_definition` row holds an ordered DAG of steps. Each step is either `auto`
(executed by an adapter) or `human` (a gate that pauses the run until an operator
approves, optionally with edits). The engine is hard-coded to four adapters today:

- `llm.extract_lead_fields` — turn raw inbound text into structured fields
- `llm.qualify_lead` — score 1–5 + recommended next action
- `llm.draft_reply` — produce a draft reply from the approved fields
- `dispatch.mock` — record a mocked send and complete the run

The seeded process is `lead-qualification` (see `src/processes/lead-qualification`).
Schema lives in `src/db/schema.ts`. The engine state machine lives in
`src/engine/engine.ts`. Adapters live in `src/engine/adapters.ts`.

### REST API

All routes accept and return JSON. Auth is intentionally absent in v1.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/runs` | Create a run, execute auto steps until the first human gate. |
| `GET` | `/api/runs/:runId` | Fetch the run + ordered steps + audit-trail-relevant state. |
| `POST` | `/api/runs/:runId/steps/:stepId/approve` | Approve the current human gate (optionally with an edited payload). |

#### `POST /api/runs`

Request:

```json
{
  "processSlug": "lead-qualification",
  "input": { "rawText": "Hi, I'm Maya from Northwind. We want pricing this week." }
}
```

Response (201):

```json
{
  "run": { "id": "<uuid>", "status": "awaiting_human", ... },
  "steps": [
    { "definitionStepId": "extract", "status": "completed", "output": { "fields": { ... } } },
    { "definitionStepId": "qualify", "status": "completed", "output": { "qualification": { ... } } },
    { "definitionStepId": "review_qualification", "status": "awaiting_human", "input": { "fields": ..., "qualification": ... } },
    { "definitionStepId": "draft_reply", "status": "pending" },
    { "definitionStepId": "approve_reply", "status": "pending" },
    { "definitionStepId": "dispatch", "status": "pending" }
  ]
}
```

#### `POST /api/runs/:runId/steps/:stepId/approve`

Request (any subset; if `output` is omitted the suggested input becomes the output):

```json
{
  "output": { "fields": { ... }, "qualification": { ... } },
  "edited": true
}
```

Errors are uniform: `{ "error": { "code": "...", "message": "..." } }` with HTTP status reflecting the failure (400 invalid body, 404 not found, 409 wrong state, 500 internal).

### Datastore

Postgres only. Four tables:

- `process_definition` — slug, version, ordered step DAG (JSONB)
- `process_run` — one per execution, with `status` ∈ `running | awaiting_human | completed | failed`
- `process_step` — one row per step in a run, with input/output JSONB and timestamps
- `audit_event` — append-only log of `run_started`, `auto_completed`, `human_edited`, `human_approved`, `run_completed`, `run_failed`

Schema lives in `src/db/schema.ts`; migrations are in `drizzle/`. Generate a new
migration after schema changes with `pnpm db:generate`.

### Integration test

`tests/integration/lead-qualification-happy-path.test.ts` walks the entire operator
journey end-to-end against a real Postgres. It is `describe.skipIf(!DATABASE_URL)`
so contributors can run `pnpm test` without a database, and CI runs it against the
`postgres:16` service container.

## Frontend skeleton (SWE-5)

The web UI is the operator's view of the v1 lead-qualification journey. It is
intentionally low-fi — component boundaries are aligned to the eventual design
system, but styling is placeholder.

### Pages

| Route | Purpose |
| --- | --- |
| `/` | Intake form. Paste raw inbound text, hit **Run**. A server action calls `handleCreateRun` and redirects to the run viewer. |
| `/runs/[runId]` | Run viewer. Renders the input, the step timeline, and an editable form whenever the active step is the current human gate. |
| `/runs` | Run history. Lists the most recent 50 runs with status badges and short input previews. |

The two human gates are client components (`ApproveQualificationForm`,
`ApproveReplyForm`) that POST to `/api/runs/:id/steps/:stepId/approve` and call
`router.refresh()` on success so the server-rendered timeline reflects the new
state without a full reload.

### End-to-end smoke test

`tests/e2e/happy-path.spec.ts` is a single Playwright spec that walks the full
journey in Chromium: open the intake page → paste a sample message → run → edit a
field at the qualification gate → approve → approve the reply → assert the
dispatch confirmation and the `completed` status badge → confirm the run shows up
in `/runs`. Run locally with:

```bash
pnpm exec playwright install --with-deps chromium  # one-time
pnpm dev:up                                        # in another terminal
pnpm test:e2e
```

CI runs it against the production build (`pnpm build && pnpm next start`) so it
exercises the same code path as a deployed app.

## Pre-commit hook

`pnpm install` wires up a husky pre-commit hook that runs:

1. `lint-staged` — Biome auto-fix on staged files
2. `pnpm typecheck` — full project typecheck

Bypass with `git commit --no-verify` only if you know what you are doing.

## CI

Every push to `main` and every pull request runs `.github/workflows/ci.yml`:
spin up Postgres → install → migrate → lint → typecheck → test → build → seed →
Playwright e2e. Merges to `main` require green CI.

## Repo layout

```
app/                 Next.js App Router (pages, layouts, route handlers)
src/db/              Drizzle schema + client
src/engine/          In-process step engine + adapters
src/processes/       Process definitions (lead-qualification)
src/api/             Framework-agnostic API handlers (called by app/api/* routes)
drizzle/             Generated SQL migrations
scripts/             tsx-runnable migration + seed scripts
tests/               Vitest tests (smoke + integration/) and Playwright (e2e/)
public/              Static assets
.github/workflows/   CI pipelines
biome.json           Lint + format config
vitest.config.ts     Test runner config
docker-compose.yml   Local Postgres for `pnpm db:up`
```

Single-package layout. We will only move to a workspace if a second deployable
artifact (worker, second app) is justified — see the design doc rationale.

## Adding a test

Put `*.test.ts` (or `*.spec.ts`) anywhere outside `node_modules`/`.next`.
Smallest example: `tests/smoke.test.ts`. Integration tests that need a database
should sit under `tests/integration/` and use `describeIntegration` from
`tests/integration/setup.ts`.

## Troubleshooting

- **`pnpm` not found**: install via `npm install -g pnpm@9` (corepack works too).
- **`pnpm install` complains about Node**: upgrade to Node 20.11+.
- **CI fails on a green local run**: run `pnpm verify` — it runs the exact CI sequence.
- **`DATABASE_URL is not set`**: copy `.env.example` to `.env.local`, or run `pnpm dev:up` which exports it for you.
- **Port 5432 already in use**: stop your existing Postgres or change the port in `docker-compose.yml` and `.env.local`.

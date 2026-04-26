# Swedenmark

Internal product. v1 vertical slice: turn an unstructured business process into structured artifacts and a recommended next action, with a human in the loop at every gate.

See the v1 design doc on the engineering kickoff issue for the product and architecture rationale.

## Stack

- **Runtime:** TypeScript on Next.js 15 (App Router) — UI + API in one repo, one deploy
- **UI:** React 19 + Tailwind v4
- **Datastore:** Postgres (added in SWE-4)
- **LLM:** Anthropic Claude (added in SWE-4)
- **Tests:** Vitest (unit), Playwright (added in SWE-5)
- **Lint/format:** Biome
- **CI:** GitHub Actions

## Onboarding (under 5 minutes)

Prereqs: Node 20.11+, pnpm 9.

```bash
git clone git@github.com:dsorensen/swedenmark.git
cd swedenmark
pnpm install
pnpm dev
```

Open http://localhost:3000 — you should see the default Next.js page.

## Common scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Run the app locally with hot reload |
| `pnpm build` | Production build |
| `pnpm start` | Run the production build |
| `pnpm lint` | Biome lint + format check |
| `pnpm lint:fix` | Biome lint + format with auto-fix |
| `pnpm format` | Format files in place |
| `pnpm typecheck` | TypeScript `--noEmit` check |
| `pnpm test` | Run Vitest once |
| `pnpm test:watch` | Run Vitest in watch mode |
| `pnpm verify` | Lint + typecheck + test + build (matches CI) |

## Pre-commit hook

`pnpm install` wires up a husky pre-commit hook that runs:

1. `lint-staged` — Biome auto-fix on staged files
2. `pnpm typecheck` — full project typecheck

Bypass with `git commit --no-verify` only if you know what you are doing.

## CI

Every push to `main` and every pull request runs `.github/workflows/ci.yml`:
lint → typecheck → test → build. Merges to `main` require green CI.

## Repo layout

```
app/                 Next.js App Router (pages, layouts, route handlers)
public/              Static assets
tests/               Vitest unit/integration tests
.github/workflows/   CI pipelines
biome.json           Lint + format config
vitest.config.ts     Test runner config
```

Single-package layout. We will only move to a workspace if a second deployable
artifact (worker, second app) is justified — see the design doc rationale.

## Adding a test

Put `*.test.ts` (or `*.spec.ts`) anywhere outside `node_modules`/`.next`.
Smallest example: `tests/smoke.test.ts`.

## Troubleshooting

- **`pnpm` not found**: install via `npm install -g pnpm@9` (corepack works too on most setups).
- **`pnpm install` complains about Node**: upgrade to Node 20.11+.
- **CI fails on a green local run**: run `pnpm verify` — it runs the exact CI sequence.

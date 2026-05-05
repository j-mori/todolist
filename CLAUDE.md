# Todolist

TypeScript 2026 reference: hexagonal monorepo, multi-layer tested, fully containerised, MSW-backed live demo at <https://j-mori.github.io/todolist/>.

Read this file first. Every decision below has an ADR — follow the link before changing the choice. Never write decisions into this file; this file is an index.

## Stack

| Area | Choice | ADR |
|---|---|---|
| Monorepo | npm workspaces | [0001](docs/adrs/0001-architecture-monorepo-tool.md) |
| BE framework | Hono on `@hono/node-server` | [0002](docs/adrs/0002-backend-framework.md) |
| Validation | Zod v4 (BE + shared contract) | [0003](docs/adrs/0003-architecture-validation.md) |
| Logging | Pino (structured JSON) | [0004](docs/adrs/0004-backend-logging.md) |
| Storage | `node:sqlite` + Kysely | [0005](docs/adrs/0005-backend-storage.md) |
| FE build | Vite + React 19 | [0006](docs/adrs/0006-frontend-build-tool.md) |
| FE data | TanStack Query v5 | [0007](docs/adrs/0007-frontend-data-fetching.md) |
| Styling | Tailwind v4 (`@tailwindcss/vite`) | [0008](docs/adrs/0008-frontend-styling.md) |
| Lint/format | Biome v2 | [0009](docs/adrs/0009-architecture-lint-format.md) |
| Tests | `node:test` (BE), Vitest (FE), Playwright (E2E) | [0010](docs/adrs/0010-tests-strategy.md), [0015](docs/adrs/0015-tests-e2e-conventions.md) |
| Containers | Per-package multi-stage Docker + compose | [0011](docs/adrs/0011-architecture-container-strategy.md) |
| Layout | Hexagonal per package | [0012](docs/adrs/0012-architecture-hexagonal-layout.md) |
| Errors as values | `Result<T, E>` + tagged-union domain errors | [0013](docs/adrs/0013-architecture-result-over-exceptions.md) |
| API contract | Zod schemas in `@todolist/shared` | [0014](docs/adrs/0014-architecture-shared-api-contract.md) |
| Pre-commit | `lefthook` running Biome on staged files | [0016](docs/adrs/0016-architecture-lefthook-pre-commit.md) |
| FE → API proxy | Same-origin `/api` (nginx in prod, Vite in dev) | [0017](docs/adrs/0017-architecture-frontend-api-proxy.md) |
| CI + demo deploy | GitHub Actions + MSW-backed GitHub Pages | [0018](docs/adrs/0018-architecture-ci-and-demo-deploy.md) |

## Where things live

```
packages/
  shared/      # API contract — Zod schemas + inferred types. No business logic.
  backend/     # Hono + node:sqlite. Hex layout: domain/ → application/ → adapters/ → main.ts (composition root).
  frontend/    # React 19 + TanStack Query. Same hex shape. main.tsx wires everything.
  e2e/         # Playwright against the docker-composed stack.
docs/
  architecture.md, testing.md, conventions.md, scripts.md
  adrs/        # NNNN-{architecture|backend|frontend|tests}-slug.md
.github/workflows/ci.yml   # PR + main pipeline; deploy job publishes the demo on main.
.claude/commands/todolist/setup.md   # the /todolist:setup skill
```

For any deeper navigation use the **Explore** subagent — it keeps reconnaissance out of the main context.

## Commands

| Script | What it does |
|---|---|
| `npm install` | Install workspace deps; installs the lefthook pre-commit hook. |
| `npm run dev` | Backend `:3000` + Vite `:5173`. Vite proxies `/api` to the backend. |
| `npm run check` | Lint + typecheck + layers + tests + bundle budget. The green-bar gate. |
| `npm run test` | Unit + integration (BE) + component (FE). |
| `npm run test:e2e` | Playwright against the docker-composed stack. |
| `npm run build` | `tsc` + `vite build` per workspace. |
| `npm run build:demo` | FE bundle for GitHub Pages: ships MSW for in-browser mocks. |
| `docker compose up --build` | Boot the production-shaped stack (FE on `:8081`, BE on `:3000`). |

Full reference: [`docs/scripts.md`](docs/scripts.md). Backend env contract: [`/.env.example`](.env.example) (`loadConfig` refuses to start if any required variable is missing).

## Rules enforced mechanically

- **Hex layers** (`npm run check:layers`): `domain/` imports nothing in-package; `application/` imports `domain/` only; `adapters/` import `application/` ports + `domain/` types; only `main.ts` wires concretes into ports. `__unsafe*` symbols are reachable from `domain/task/` only.
- **Bundle budget** (`npm run check:bundle-size`): JS ≤ 110 kB / CSS ≤ 8 kB gzipped on the regular build.
- **Format** (Biome via lefthook): two-space indent, single quotes, trailing commas, 100-char line. Auto-applied to staged files on commit.

## Rules to follow by hand

- **No `any`**, no `// @ts-expect-error` without a linked ADR or issue.
- **Errors are typed values** at the domain layer. `throw` only for programmer errors. Validate at boundaries, trust internally.
- **Imports use `.ts` extensions** (Node 24 strip mode + `rewriteRelativeImportExtensions`).
- **Comments explain non-obvious *why*** — never *what*.
- **Tests must fail when their target behaviour breaks.** If a test passes after you delete the behaviour, delete the test. Mocks belong at the boundary the layer owns: `fetch` for FE component tests, nothing for BE integration tests, no mocks at all in E2E.

Full conventions: [`docs/conventions.md`](docs/conventions.md). Per-layer test scope: [`docs/testing.md`](docs/testing.md).

## Working with Claude in this repo

- Read CLAUDE.md, then the ADR that owns the area you're touching. Don't grep until the index has failed you.
- Spawn the **Explore** subagent for anything past two file reads.
- Touch only the layer the task owns; respect the hex boundaries enforced by `check:layers`.
- Use the LSP tools (`goToDefinition`, `findReferences`, `documentSymbol`) before grep when navigating code.
- Run `npm run check` before declaring a change done. E2E (`npm run test:e2e`) is a separate gate — run it when you touch HTTP boundaries, persistence, or UI flows.
- New decisions go in a new ADR (`docs/adrs/NNNN-{area}-{slug}.md`), not in this file or in commit messages.

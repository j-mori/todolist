# Architecture Decision Records

Each ADR captures one decision: the context, the choice, the consequences, and what was rejected. Filenames follow the pattern `NNNN-{area}-{slug}.md` where area is `architecture`, `backend`, `frontend`, or `tests`.

## Architecture (cross-cutting)

| # | Decision |
|---|---|
| [0001](0001-architecture-monorepo-tool.md) | Monorepo via npm workspaces |
| [0003](0003-architecture-validation.md) | Zod for runtime validation |
| [0009](0009-architecture-lint-format.md) | Biome for lint and format |
| [0011](0011-architecture-container-strategy.md) | Per-package multi-stage Docker + root compose |
| [0012](0012-architecture-hexagonal-layout.md) | Hexagonal folder layout per package |
| [0013](0013-architecture-result-over-exceptions.md) | `Result<T, E>` and tagged-union errors over thrown exceptions |
| [0014](0014-architecture-shared-api-contract.md) | API contract location — Zod schemas in `@todolist/shared` |
| [0016](0016-architecture-lefthook-pre-commit.md) | `lefthook` for pre-commit hooks |
| [0017](0017-architecture-frontend-api-proxy.md) | Same-origin `/api` via reverse proxy (nginx in prod, Vite in dev) |

## Backend

| # | Decision |
|---|---|
| [0002](0002-backend-framework.md) | Hono as the backend framework |
| [0004](0004-backend-logging.md) | Pino for structured logging |
| [0005](0005-backend-storage.md) | `node:sqlite` + Kysely for storage |

## Frontend

| # | Decision |
|---|---|
| [0006](0006-frontend-build-tool.md) | Vite + React 19 |
| [0007](0007-frontend-data-fetching.md) | TanStack Query v5 for server state |
| [0008](0008-frontend-styling.md) | Tailwind v4 |

## Tests

| # | Decision |
|---|---|
| [0010](0010-tests-strategy.md) | Three-layer test strategy — `node:test`, Vitest, Playwright |
| [0015](0015-tests-e2e-conventions.md) | E2E conventions — Playwright + docker compose, role-based selectors, API-driven isolation |

## Writing a new ADR

1. Pick the next sequential number and the area prefix.
2. Copy the shape of an existing one — `Status`, `Date`, `Context`, `Decision`, `Consequences` (positive + trade-off + follow-up), `Alternatives considered`.
3. State alternatives **and why each was rejected**. If you can't articulate them, the decision is not yet made.
4. Add the new entry to the table above.

# Todolist

TypeScript 2026 reference app: production-ready, hexagonal, multi-layer tested, fully containerised.

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

## Layout

```
packages/
  shared/        # API contract (Zod schemas + inferred types) under src/contract/. No business logic. (ADR-0014)
  backend/
    src/
      domain/         # pure: entities, value objects, errors
      application/    # use cases + ports
      adapters/
        http/         # Hono routes, request-id, request-logger, error-handler, respond helper
        persistence/
          sqlite/     # node:sqlite + Kysely + initSchema + repository
      main.ts         # composition root: compose({ databasePath, logger?, corsOrigin? })
      index.ts        # server entrypoint
    test/integration/ # API-level tests against the real composed app (in :memory: SQLite)
  frontend/
    src/
      domain/         # Result<T,E>, ApiClientError tagged union, ApiClientErrorException
      application/
        api-context.tsx                 # TasksApi via React context
        notifications/                  # in-house toasts (provider + format-api-client-error helper)
        queries/                        # use-tasks-query + 5 mutation hooks + mutation-helpers
        formatting/                     # Intl-based timestamp formatter
      adapters/
        api/          # http-client (fetch + request-id + schema-parsed responses), tasks-api, api-base-url
      ui/             # AppShell · TaskList · TaskRow · AddTaskForm · TaskTitleInput · NotificationsViewport · ErrorBoundary · LiveRegion + tests
      main.tsx        # composition root: builds httpClient + tasksApi + QueryClient + NotificationsProvider + provider tree
      theme.css       # @theme design tokens (light + dark via prefers-color-scheme)
    .env.example      # documents VITE_API_BASE_URL (defaults to /api)
  e2e/                # Playwright suite — drives the docker-composed stack via role-based selectors (ADR-0015)
    playwright.config.ts
    playwright/
      global-setup.ts        # auto-detect external stack; otherwise docker compose up -d --wait --build
      global-teardown.ts     # docker compose down -v iff setup brought the stack up
      fixtures.ts            # apiClient + cleanDb autoFixture + seedTasks + taskListPage
      pages/task-list.page.ts # thin page object for shared locators
    tests/                  # smoke · add-task · complete-reopen · edit-task · delete-task · error-recovery
docs/
  adrs/        # Architecture Decision Records, prefixed by area: architecture | backend | frontend | tests
  architecture.md
  testing.md
```

## Commands

| Script | What it does |
|---|---|
| `npm install` | Install all workspace deps |
| `npm run dev` | Run BE + FE dev servers in parallel |
| `npm run build` | tsc + vite build per workspace |
| `npm run test` | `node:test` (BE: 82 unit + integration) + Vitest (FE: 23) — green-bar gate |
| `npm run test:integration` | BE integration suite only (`packages/backend/test/integration/**`) |
| `npm run test:e2e` | Playwright E2E (10 specs against the docker-composed stack — see ADR-0015) |
| `npm run test:e2e:ui` / `:report` / `:headed` | Playwright UI mode / HTML report / headed run (delegate to the e2e workspace) |

### Backend configuration

`packages/backend/src/index.ts` calls `loadConfig(process.env)` (see `src/config.ts`) and refuses to start if any required variable is missing. Required: `PORT`, `DATABASE_PATH`, `CORS_ORIGIN`. Optional: `MAX_BODY_BYTES`, `LOG_LEVEL`, `NODE_ENV`. See `.env.example` at the repo root for the canonical list. Defaults live there, not in code.

Composition root is `compose(deps)` in `packages/backend/src/main.ts` — pure dependency injection, takes every port. The entrypoint (`index.ts`) and the integration test helper both call it directly. SQLite wiring is encapsulated in `adapters/persistence/sqlite/wiring.ts:openWiredDatabase(path)` so both call sites share it.
| `npm run lint` | `biome lint .` |
| `npm run format` | `biome format --write .` |
| `npm run typecheck` | `tsc --noEmit` per workspace |
| `npm run check:layers` | `dependency-cruiser` enforces the hex-layer import rules |
| `npm run check:bundle-size` | builds the FE and asserts JS ≤ 110 kB / CSS ≤ 8 kB gzipped |
| `npm run check` | lint + typecheck + layers + test + bundle-size (the green-bar gate) |
| `docker compose up --build` | Boot the full stack |

Stack ports: BE on `:3000`, FE on `:8081` (Docker) or `:5173` (Vite dev). 8080 is taken by Docker Desktop on the dev machine.

The FE always talks to the API at the relative path `/api/...`. In dev, Vite's `server.proxy` rewrites it to `http://localhost:3000`; in Docker, nginx in the FE container rewrites it to `http://backend:3000`. No CORS in either supported environment. Override with `VITE_API_BASE_URL` (build-time) only for unusual deployments.

## Layering rules (hexagonal)

- `domain/` imports nothing from `application/` or `adapters/`.
- `application/` imports `domain/` only. Defines ports (interfaces).
- `adapters/` import `application/` ports + `domain/` types. Never the other way.
- `main.ts` is the *only* file allowed to wire concrete adapters into ports.

Layer rules are enforced mechanically by `npm run check:layers` (`dependency-cruiser`). The same config also forbids importing `__unsafe*` symbols outside `domain/task/`.

## Testing

Each test must justify its existence by failing if a real behaviour breaks.

- **Unit** (`node:test`, BE): pure domain + use cases. No I/O. No port mocks at the application boundary except where simulating adapter behaviour the unit must react to.
- **Integration** (`node:test`, BE): HTTP + persistence against real adapters (in-memory SQLite, in-process Hono). No port-level mocks.
- **Component** (Vitest + Testing Library + happy-dom, FE): renders components with realistic props/contexts; asserts what the user perceives.
- **E2E** (Playwright, `packages/e2e`): user journeys against the docker-composed stack with API-driven seeding/cleanup. Role-based selectors only; no `data-testid`. Serial workers (shared SQLite). See ADR-0015.

If a test passes after deleting its target behaviour, the test is wrong. If a test mocks an adapter at the port boundary, it is the wrong layer.

## Conventions

- **No `any`.** No `// @ts-expect-error` without an ADR or an issue-link comment.
- **Comments only when explaining a non-obvious *why*.** Code that needs comments to explain *what* should be rewritten.
- **Prefer Node built-ins** (`node:test`, `node:sqlite`, `node --run`, `--experimental-strip-types`) over deps.
- **Errors as typed values** at the domain layer (e.g. `Result<T, DomainError>`); throw only for programmer errors.
- **Validate at boundaries, trust internally.** Zod parses request payloads and constructs value objects; once inside the domain, types are guaranteed.
- **Two-space indent, single quotes, trailing commas, 100-char line.** Enforced by Biome.
- **Imports use `.ts` extensions** (Node 24 strip mode + `rewriteRelativeImportExtensions`).

## Pointers

- Architecture (standalone, public): [`docs/architecture.md`](docs/architecture.md)
- Testing (per-layer scope): [`docs/testing.md`](docs/testing.md)
- ADRs: [`docs/adrs/`](docs/adrs/) — filenames are `NNNN-{architecture|backend|frontend|tests}-{slug}.md`
- Pre-commit hook: [`lefthook.yml`](lefthook.yml) (ADR-0016)

## Token tips for future Claude sessions

- Read this file first; **don't grep blindly**.
- Use the **Explore** subagent for any reconnaissance beyond two reads — keeps the main context lean.
- Touch only the layer the task owns; respect the hex boundaries.
- Decisions go in ADRs, not in this file. This file stays an index.

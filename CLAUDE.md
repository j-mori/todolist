# Todolist

State-of-the-art TypeScript 2026 reference app: production-ready, hexagonal, multi-layer tested, fully containerised.

> Build is split across 7 sessions tracked at `/Users/jacopo.mori/Sites/obsidian/claude/todolist/00-master-plan.md`. **Always read the latest handoff in `/Users/jacopo.mori/Sites/obsidian/claude/todolist/handoffs/` before changing code.**

## Stack

| Area | Choice | ADR |
|---|---|---|
| Runtime | Node 24 LTS (Alpine in containers) | [0002](docs/decisions/0002-node-version.md) |
| Monorepo | npm workspaces | [0001](docs/decisions/0001-monorepo-tool.md) |
| BE framework | Hono on `@hono/node-server` | [0003](docs/decisions/0003-backend-framework.md) |
| Validation | Zod v4 (BE + shared contract) | [0004](docs/decisions/0004-validation.md) |
| Logging | Pino (structured JSON) | [0005](docs/decisions/0005-logging.md) |
| Storage | `node:sqlite` + Kysely | [0006](docs/decisions/0006-storage.md) |
| FE build | Vite + React 19 | [0007](docs/decisions/0007-frontend-build-tool.md) |
| FE data | TanStack Query v5 | [0008](docs/decisions/0008-frontend-data-fetching.md) |
| Styling | Tailwind v4 (`@tailwindcss/vite`) | [0009](docs/decisions/0009-styling.md) |
| Lint/format | Biome v2 | [0010](docs/decisions/0010-lint-format.md) |
| Tests | `node:test` (BE), Vitest (FE), Playwright (E2E) | [0011](docs/decisions/0011-test-strategy.md), [0030](docs/decisions/0030-e2e-conventions.md) |
| Containers | Per-package multi-stage Docker + compose | [0012](docs/decisions/0012-container-strategy.md) |
| Layout | Hexagonal per package | [0013](docs/decisions/0013-hexagonal-layout.md) |

## Layout

```
packages/
  shared/        # API contract (Zod schemas + inferred types) under src/contract/. No business logic. (ADR-0019)
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
        notifications/                  # in-house toasts (provider + format-api-client-error helper) — ADR-0028
        queries/                        # use-tasks-query + 5 mutation hooks + mutation-helpers (ADR-0027)
        formatting/                     # Intl-based timestamp formatter
      adapters/
        api/          # http-client (fetch + request-id + schema-parsed responses), tasks-api, api-base-url
      ui/             # AppShell · TaskList · TaskRow · AddTaskForm · TaskTitleInput · NotificationsViewport · ErrorBoundary · LiveRegion + tests
      main.tsx        # composition root: builds httpClient + tasksApi + QueryClient + NotificationsProvider + provider tree
      theme.css       # @theme design tokens (light + dark via prefers-color-scheme) — ADR-0026
    .env.example      # documents VITE_API_BASE_URL (defaults to /api) — ADR-0023
  e2e/                # Playwright suite — drives the docker-composed stack via role-based selectors (ADR-0030)
    playwright.config.ts
    playwright/
      global-setup.ts        # auto-detect external stack; otherwise docker compose up -d --wait --build
      global-teardown.ts     # docker compose down -v iff setup brought the stack up
      fixtures.ts            # apiClient + cleanDb autoFixture + seedTasks + taskListPage
      pages/task-list.page.ts # thin page object for shared locators
    tests/                  # smoke · add-task · complete-reopen · edit-task · delete-task · error-recovery
docs/
  decisions/   # ADRs (see docs/decisions/README.md)
  sessions/    # per-session plans, kept after approval
```

## Commands

| Script | What it does |
|---|---|
| `npm install` | Install all workspace deps |
| `npm run dev` | Run BE + FE dev servers in parallel |
| `npm run build` | tsc + vite build per workspace |
| `npm run test` | `node:test` (BE: 82 unit + integration) + Vitest (FE: 23) — green-bar gate |
| `npm run test:integration` | BE integration suite only (`packages/backend/test/integration/**`) |
| `npm run test:e2e` | Playwright E2E (10 specs against the docker-composed stack — see ADR-0030) |
| `npm run test:e2e:ui` / `:report` / `:headed` | Playwright UI mode / HTML report / headed run (delegate to the e2e workspace) |

### Backend configuration

`packages/backend/src/index.ts` calls `loadConfig(process.env)` (see `src/config.ts`) and refuses to start if any required variable is missing. Required: `PORT`, `DATABASE_PATH`, `CORS_ORIGIN`. Optional: `MAX_BODY_BYTES`, `LOG_LEVEL`, `NODE_ENV`. See `.env.example` at the repo root for the canonical list. Defaults live there, not in code (see ADR-0022).

Composition root is `compose(deps)` in `packages/backend/src/main.ts` — pure dependency injection, takes every port. The entrypoint (`index.ts`) and the integration test helper both call it directly. SQLite wiring is encapsulated in `adapters/persistence/sqlite/wiring.ts:openWiredDatabase(path)` so both call sites share it.
| `npm run lint` | `biome lint .` |
| `npm run format` | `biome format --write .` |
| `npm run typecheck` | `tsc --noEmit` per workspace |
| `npm run check:layers` | `dependency-cruiser` enforces the hex-layer import rules (ADR-0032) |
| `npm run check:bundle-size` | builds the FE and asserts JS ≤ 110 kB / CSS ≤ 8 kB gzipped (ADR-0029) |
| `npm run check` | lint + typecheck + layers + test + bundle-size (the green-bar gate) |
| `docker compose up --build` | Boot the full stack |

Stack ports: BE on `:3000`, FE on `:8081` (Docker) or `:5173` (Vite dev). 8080 is taken by Docker Desktop on the dev machine.

The FE always talks to the API at the relative path `/api/...`. In dev, Vite's `server.proxy` rewrites it to `http://localhost:3000`; in Docker, nginx in the FE container rewrites it to `http://backend:3000`. No CORS in either supported environment. Override with `VITE_API_BASE_URL` (build-time) only for unusual deployments. See ADR-0023.

## Layering rules (hexagonal)

- `domain/` imports nothing from `application/` or `adapters/`.
- `application/` imports `domain/` only. Defines ports (interfaces).
- `adapters/` import `application/` ports + `domain/` types. Never the other way.
- `main.ts` is the *only* file allowed to wire concrete adapters into ports.

Layer rules are enforced mechanically by `npm run check:layers` (`dependency-cruiser`, ADR-0032). The same config also forbids importing `__unsafe*` symbols outside `domain/task/` (ADR-0022 follow-up).

## Testing

Each test must justify its existence by failing if a real behaviour breaks.

- **Unit** (`node:test`, BE): pure domain + use cases. No I/O. No port mocks at the application boundary except where simulating adapter behaviour the unit must react to.
- **Integration** (`node:test`, BE): HTTP + persistence against real adapters (in-memory SQLite, in-process Hono). No port-level mocks.
- **Component** (Vitest + Testing Library + happy-dom, FE): renders components with realistic props/contexts; asserts what the user perceives.
- **E2E** (Playwright, `packages/e2e`): user journeys against the docker-composed stack with API-driven seeding/cleanup. Role-based selectors only; no `data-testid`. Serial workers (shared SQLite). See ADR-0030.

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
- ADR index: [`docs/decisions/README.md`](docs/decisions/README.md)
- Session plans (kept after approval): [`docs/sessions/`](docs/sessions/)
- CI: [`.gitlab-ci.yml`](.gitlab-ci.yml) (ADR-0031)
- Pre-commit hook: [`lefthook.yml`](lefthook.yml) (ADR-0033)
- Master plan + handoffs (author-local, not portable): `~/Sites/obsidian/claude/todolist/`

## Token tips for future Claude sessions

- Read this file + the latest handoff first; **don't grep blindly**.
- Use the **Explore** subagent for any reconnaissance beyond two reads — keeps the main context lean.
- Touch only the layer your session owns. The session roadmap pins responsibilities.
- Decisions go in ADRs, not in this file. This file stays an index.

# Architecture

How the code is organised. The **why** behind each choice lives in the [ADRs](adrs/).

## Workspaces

| Package | Role |
|---|---|
| `packages/shared` | Wire contract — Zod schemas + inferred types. No business logic. |
| `packages/backend` | Hono app + `node:sqlite` persistence. |
| `packages/frontend` | React 19 SPA. |
| `packages/e2e` | Playwright suite against the docker-composed stack. |

## Hexagonal layout

Each runtime package follows the same shape ([ADR-0012](adrs/0012-architecture-hexagonal-layout.md)):

```
src/
  domain/        # pure: entities, value objects, errors. No I/O.
  application/   # use cases (BE) or hooks (FE). Defines ports.
  adapters/      # concrete adapters: HTTP, persistence, API client, UI.
  main.ts        # composition root — the only file that wires adapters into ports.
```

Layer direction is enforced by `npm run check:layers`.

## Request flow

```
 Browser  ──HTTP──▶  nginx :8081  ──/api/*──▶  Hono :3000  ──▶  Use case  ──port──▶  SQLite (Kysely)
                    (SPA + proxy)
```

In dev, Vite (`:5173`) replaces nginx — same `/api` proxy, same source code. The FE bundle never references an absolute API host.

## REST surface

| Verb | Path | Purpose | Status |
|---|---|---|---|
| GET | `/healthz` | Liveness; no I/O. | 200 |
| GET | `/readyz` | Readiness; `SELECT 1`. | 200 / 503 |
| GET | `/tasks` | List, newest first. | 200 |
| POST | `/tasks` | Create. | 201 + `Location` |
| PATCH | `/tasks/:id` | Update title. | 200 / 400 / 404 |
| POST | `/tasks/:id/complete` | Mark complete (idempotent). | 200 / 404 |
| POST | `/tasks/:id/reopen` | Mark pending (idempotent). | 200 / 404 |
| DELETE | `/tasks/:id` | Delete. | 204 / 404 |

Errors use a typed envelope `{ error: { kind, ... } }`; the discriminated union lives in `@todolist/shared` ([ADR-0014](adrs/0014-architecture-shared-api-contract.md)).

## What's in the box

- **Backend** — Hono with `secureHeaders`, `cors`, `bodyLimit`, request-id + Pino logging, awaited `SIGTERM` shutdown, env-validated config.
- **Frontend** — TanStack Query v5 with optimistic mutations and rollback; in-house toasts; same-origin `/api` (no CORS).
- **Containers** — per-package multi-stage Dockerfiles + root compose. Backend on `:3000`, FE-with-nginx on `:8081`. SQLite on a named volume.
- **Pre-commit** — `lefthook` runs Biome on staged files ([ADR-0016](adrs/0016-architecture-lefthook-pre-commit.md)).

## Pointers

- [`docs/adrs/`](adrs/) — every decision, with context and rejected alternatives.
- [`docs/testing.md`](testing.md) — what each test layer does and doesn't.
- [`docs/conventions.md`](conventions.md) — code rules and discipline.

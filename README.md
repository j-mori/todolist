# Todolist

> State-of-the-art TypeScript 2026 reference app: production-ready, hexagonal, multi-layer tested, fully containerised.

## Quickstart (30 seconds)

```bash
git clone <this repo> && cd todolist
docker compose up --build
```

Then open <http://localhost:8081> for the UI and <http://localhost:3000/health> for the API healthcheck.

## Local development

```bash
npm install            # provisions all workspaces (Node 24+, npm 11+)
npm run dev            # runs backend + frontend dev servers in parallel
npm run check          # lint + typecheck + unit/component tests + bundle budget — green-bar gate
npm run build          # tsc + vite build per package
```

## End-to-end tests

Playwright drives the docker-composed stack (BE + nginx-fronted FE) through the same paths a real user would.

```bash
npm run install-browsers --workspace @todolist/e2e   # one-off: downloads Chromium
npm run test:e2e                                     # boots stack if not running, runs suite, tears down
npm run test:e2e:ui                                  # interactive Playwright UI mode
npm run test:e2e:report                              # opens the last HTML report
```

The suite auto-detects an externally-managed stack: if you've already run `docker compose up -d`, it leaves the stack alone in teardown. Otherwise it spins one up via `docker compose up -d --wait --build` and tears it down with `docker compose down -v`. See [`packages/e2e/README.md`](packages/e2e/README.md) and [ADR-0030](docs/decisions/0030-e2e-conventions.md).

## Architecture in one paragraph

Three workspaces — `packages/backend`, `packages/frontend`, `packages/shared` — coordinated by npm workspaces. Each runtime package follows a hexagonal layout: `domain/` (pure logic, zero deps), `application/` (use cases + ports), `adapters/` (HTTP, persistence, UI), `main.ts` as the composition root. The backend is Hono on Node 24 with `node:sqlite` + Kysely; the frontend is React 19 + Vite + Tailwind v4 + TanStack Query. Tests run in three layers: `node:test` for the backend, Vitest + Testing Library for components, Playwright for end-to-end against the docker-composed stack.

See [`CLAUDE.md`](CLAUDE.md) for the full stack map and conventions, and [`docs/decisions/README.md`](docs/decisions/README.md) for the architecture decision records that justify each choice.

## How this repo is built

This repo is built across **7 focused sessions**, each scoped to one concern (foundations, BE domain, BE adapters, FE foundations, FE features, E2E, polish). The plan and per-session handoffs live in [`obsidian/claude/todolist/`](https://github.com/jacopo-mori/notes — local) for the author, and inside this repo at:

- Per-session plans: [`docs/sessions/`](docs/sessions/)
- Session 1 plan: [`docs/sessions/01-plan.md`](docs/sessions/01-plan.md)

## CI

Not implemented in Session 1. Recommended shape (delivered in Session 7):

```
on: [push, pull_request]
jobs:
  check:
    steps:
      - actions/checkout
      - actions/setup-node@v4   { node-version: 24 }
      - run: npm ci
      - run: npm run check
      - run: npm run build
  e2e:
    steps:
      - … docker compose up + npx playwright test
```

## License

UNLICENSED — personal showcase, not for redistribution.

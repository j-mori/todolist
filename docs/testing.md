# Testing

Four layers, three runners, 115 tests. Each test must fail when its target behaviour breaks — otherwise it isn't paying rent.

| Layer | Runner | Where | Count |
|---|---|---|---|
| Unit (BE) | `node:test` | `packages/backend/src/**/*.test.ts` | ~70 |
| Integration (BE) | `node:test` | `packages/backend/test/integration/**` | ~12 |
| Component (FE) | Vitest + happy-dom + Testing Library | `packages/frontend/src/**/*.test.tsx` | 23 |
| E2E | Playwright | `packages/e2e/tests/**/*.spec.ts` | 10 |

## What each layer covers

**Unit** — pure domain (entities, value objects, errors) and use cases. Use cases consume in-memory ports (`InMemoryTaskRepository`, `FixedClock`, `SequentialIdGenerator`). No sockets, no SQLite, no Hono.

**Integration** — the real composed app: Hono in-process via `app.request(...)`, real `:memory:` SQLite, real middleware. Asserts status codes, headers, and the wire payload (validated against `errorResponseSchema` from `@todolist/shared`). No mocks at port boundaries.

**Component** — components rendered with a real provider tree (`renderWithProviders`) and a stubbed `fetch`. Mocks live at the `fetch` boundary, never at the `tasksApi` port. Asserts what the user perceives — accessible names, focus position, optimistic UI, rollback toasts.

**E2E** — real Chromium against the docker-composed stack. `globalSetup` boots compose if it isn't already running. Per-test isolation via the `cleanDb` fixture (API-driven). Selectors are `getByRole(..., { name })`; never `data-testid`. See [ADR-0015](adrs/0015-tests-e2e-conventions.md).

## Commands

| Command | Time | Docker |
|---|---|---|
| `npm run test` | ~3 s | no |
| `npm run test:integration` | ~1 s | no |
| `npm run check` (gate) | ~12 s | no |
| `npm run test:e2e` | ~30 s warm | yes |

E2E is intentionally outside `npm run check` — it needs Docker and runs longer.

## Discipline

- If deleting the production code leaves the test green, the test is wrong.
- If a test mocks an adapter at the port boundary, it's at the wrong layer.
- No `await wait(N)` — `FixedClock.advance(N)` exists for a reason.
- No `data-testid`, no `page.waitForTimeout`, no `waitForLoadState('networkidle')`.
- No `it.skip` in main.

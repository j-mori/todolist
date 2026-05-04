# Testing

Three runners, four layers. Every test must justify its existence by failing if a real behaviour breaks. If deleting the target behaviour leaves the test green, the test is wrong. If a test mocks an adapter at the port boundary, it is at the wrong layer.

## The pyramid

```
           ┌──────────────────────┐
           │     E2E (10)         │  Playwright + docker compose
           │     packages/e2e     │
        ┌──┴──────────────────────┴──┐
        │   Component (23)            │  Vitest + Testing Library + happy-dom
        │   packages/frontend         │
     ┌──┴─────────────────────────────┴──┐
     │   Integration (~12 of 82)          │  node:test + composed app + :memory: SQLite
     │   packages/backend/test/integration│
  ┌──┴────────────────────────────────────┴──┐
  │   Unit (~70 of 82)                        │  node:test, pure
  │   packages/backend/src/**/*.test.ts       │
  └───────────────────────────────────────────┘
```

Total: 82 BE + 23 FE + 10 E2E = **115 tests**.

## Unit (BE)

**Runner:** `node:test` via `--experimental-strip-types`. No build step.
**Where:** `packages/backend/src/**/*.test.ts`.
**Scope:** pure domain (entities, value objects, errors) and use cases. Use cases consume `InMemoryTaskRepository`, `FixedClock`, and `SequentialIdGenerator` from `application/test-support/` so behaviour is deterministic.

**What it does:** asserts the rules, not the wiring. `TaskTitle` rejects whitespace; `Task.complete` is idempotent; `update` returns `taskNotFound` when the id is missing.

**What it does NOT do:** open sockets, hit SQLite, instantiate Hono, or assert on JSON envelopes. Those tests live one layer up.

## Integration (BE)

**Runner:** `node:test` via `--experimental-strip-types`.
**Where:** `packages/backend/test/integration/**/*.test.ts`.
**Scope:** the real composed app — Hono in-process, `compose(deps)` with a real `:memory:` SQLite repo, real `secureHeaders`, real `bodyLimit`. Tests issue `app.request('/tasks', ...)` and assert on status, headers, and the wire payload (validated against `errorResponseSchema` from `@todolist/shared`).

**What it does:** proves the BE behaves end-to-end at the API surface. POST round-trips, idempotency on duplicate complete, 404 on missing id, 413 on body-limit exceedance, 500 envelope shape, security headers presence, X-Request-Id echo.

**What it does NOT do:** mock at the port boundary. Persistence is the real `node:sqlite` adapter; HTTP is the real Hono runtime. Determinism comes from `FixedClock.advance(N)` rather than `await wait(N)` (every wait is gone, ADR-0022).

**Run only the integration layer:** `npm run test:integration` (delegates to the backend workspace).

## Component (FE)

**Runner:** `vitest run` with `happy-dom` and Testing Library.
**Where:** `packages/frontend/src/**/*.test.tsx`.
**Scope:** components rendered in a real provider tree (`renderWithProviders` builds a real `httpClient` + `tasksApi` against a stubbed `fetch`, then wraps in `<TasksApiProvider>` + `<QueryClientProvider>` (retry off, gcTime 0) + `<NotificationsProvider>` and mounts `<NotificationsViewport />`). Mocks live at the `fetch` boundary via `buildFetch([{ method, path, respond }])`.

**What it does:** asserts behaviour as the user perceives it — accessible names, `role="alert"` copy, focus position after delete, optimistic UI, rollback + toast on 500, `aria-live` announcements, idempotent transitions.

**What it does NOT do:** reach into TanStack Query's cache, the notifications reducer's state, or any internal context. It does not mock `tasksApi` either — the api adapter is part of what's under test.

## End-to-end (Playwright)

**Runner:** `@playwright/test` 1.51, Chromium-only by default.
**Where:** `packages/e2e/tests/**/*.spec.ts`.
**Scope:** real Chromium driving the docker-composed stack. `globalSetup` auto-detects an externally managed stack; otherwise it runs `docker compose up -d --wait --build`, then `down -v` in teardown. Per-test isolation via the `cleanDb` autoFixture (`GET /api/tasks → DELETE` each).

**What it does:** validates the user journeys from handoff-05 — add, complete/reopen, edit (Save / Escape), delete with focus-move, error recovery. Selectors are `getByRole(..., { name })`, mirroring the FE's `aria-label` props.

**What it does NOT do:**
- Use `data-testid`. The FE's accessible names ARE the test API.
- Use `page.waitForTimeout(...)` or `page.waitForLoadState('networkidle')`. Wait on user-visible state or `page.waitForResponse(/\/api\/tasks\b/)`.
- Use `.check()` / `.uncheck()` on rollback-prone interactions. They retry until the post-condition holds, which can hide a rollback. Use `.click()` instead.
- Connect to the database directly. Cleanup goes through the API.

See [ADR-0030](decisions/0030-e2e-conventions.md) for the full convention list and [`packages/e2e/README.md`](../packages/e2e/README.md) for the run cookbook.

## What runs where

| Command | Layers | Time | Docker |
|---|---|---|---|
| `npm run test` | unit + integration (BE) + component (FE) | ~3s | no |
| `npm run test:integration` | integration (BE) only | ~1s | no |
| `npm run check` | lint + typecheck + layers + `test` + bundle-size | ~12s | no |
| `npm run test:e2e` | e2e (Playwright) | ~30s warm, ~90s cold-boot | yes |
| `npm run test:e2e:ui` | Playwright UI mode (interactive) | — | yes |

CI runs `check` first; only if green does it boot Docker for `e2e` (ADR-0031).

## Anti-patterns

- **Mocking `tasksApi` in component tests.** The api adapter is part of the FE's contract with the BE. Mock at the `fetch` boundary instead.
- **`data-testid`.** Reach for the accessible name; if it doesn't exist, fix the component, not the test.
- **`vi.mock` of internal modules.** If you need to mock something internal, the design is wrong.
- **Asserting on `console.error` without expecting it.** Either swallow the noise (e.g. ErrorBoundary tests) or surface it.
- **`await wait(N)`.** `FixedClock.advance(N)` exists for a reason — use it.
- **`it.skip` left in main.** Either delete or fix.

## Adding a new test

1. **Choose the layer.** Unit if it doesn't need HTTP or persistence. Integration if it needs the API surface. Component if it needs a rendered DOM. E2E only if the journey crosses every layer and only at the rate of one spec per real user behaviour.
2. **Find the existing helpers.** `task.test-support.ts` (BE), `test-helpers.tsx` + `buildFetch` + `taskFixture` (FE), `apiClient` + `seedTasks` + `cleanDb` + `TaskListPage` (E2E).
3. **Make it fail first.** Run the test against the current code; it should fail. Then ship the change.
4. **Assert on observable behaviour.** Status codes, accessible text, focus position. Not internal state.

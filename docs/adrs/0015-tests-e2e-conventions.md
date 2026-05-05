# ADR-0015: E2E conventions — Playwright + docker compose, role-based selectors, API-driven isolation

**Status:** accepted
**Date:** 2026-05-04

## Context

ADR-0010 chose Playwright as the third test layer ("E2E against the docker-composed stack with seeded data"). The conventions below are pinned so they aren't re-litigated each time the suite grows.

Two structural choices framed the rest:

1. **The whole stack lives in docker compose.** The browser must reach the FE through nginx (`:8081`) so the same `/api` rewrite rules production uses are exercised. Local-only setups (running BE + Vite dev directly) would skip the production nginx proxy and the production security headers.
2. **The BE persists to a single SQLite database.** There's no notion of a per-test database or a "test mode". Trying to bolt either on would push test-only seams into production code.

These two facts shape every other convention below.

## Decision

**1. Stack lifecycle owned by Playwright, with auto-detect for developer-managed stacks.**

`globalSetup` probes `:8081/healthz` and `:8081/api/readyz`. If both succeed, it assumes a developer ran `docker compose up -d` themselves and stashes a marker (`TODOLIST_E2E_STACK_OWNED=external`) so `globalTeardown` leaves the stack alone. Otherwise it runs `docker compose up -d --wait --build` from the repo root and stores `TODOLIST_E2E_STACK_OWNED=owned`; `globalTeardown` then runs `docker compose down -v`. The `-v` drops the `todolist-data` volume so consecutive cold runs don't carry state forward.

Rejected: Playwright's `webServer` config. It's designed for a single-process dev server that Playwright can spawn and kill; orchestrating two containers via compose with healthcheck-based readiness needs the explicit setup/teardown hooks.

**2. Per-test isolation is API-driven.**

A `cleanDb` autoFixture in `playwright/fixtures.ts` runs before every test: `GET /api/tasks` then `DELETE /api/tasks/:id` per task. A separate `seedTasks(titles)` fixture POSTs ahead of tests that need pre-populated state. Both go through Playwright's built-in `request` fixture so requests share cookies/proxy with the page.

Rejected: a test-only `POST /test/reset` endpoint. Pollutes the BE wire surface; ADR-0013 (Result over exceptions) would force shaping its responses too. Six lines of fixture code do the job without adding a production-code seam.

Rejected: `docker compose down/up` between tests. Adds ~10 s per test and gains nothing over an honest API wipe.

**3. Tests run serially (`workers: 1`, `fullyParallel: false`).**

The BE's single SQLite database is shared mutable state across the whole suite. A parallel `cleanDb` fixture would race in-flight mutations from another test; tests would step on each other's seed data.

Per-worker DB isolation would require either a `DATABASE_PATH`-per-worker env (forces compose-time multiplexing) or runtime DB switching via a header (test-only seam). Neither earns its keep when the suite is small (~10 tests, ~4 s) and serial runtime is acceptable.

**4. Selectors are role-based, never `data-testid`.**

The FE components own their `aria-label` props (`Mark "<title>" as completed`, `Edit "<title>"`, etc.). Playwright's `page.getByRole('checkbox', { name: ... })` resolves them via the standard ARIA role/name model the browser already exposes. `data-testid` is a coupling escape hatch for components whose names don't already distinguish them — none of ours fall into that category.

The `TaskListPage` page object exposes the locators that show up in more than one spec; everything else stays inline. Page objects earn their place when locators repeat, not when actions repeat.

**5. No `waitForTimeout`, no `waitForLoadState('networkidle')`.**

Both are flake amplifiers. The right primitive in order of preference is:
- Locator auto-wait (`expect(locator).toBeVisible()`, `toBeChecked()`, `toBeFocused()` …).
- `page.waitForResponse(...)` when a test asserts post-server state and the optimistic UI would otherwise race the second action.
- `expect.poll(...)` for assertions that depend on accumulating events (e.g. counting that no PATCH was issued).

Concretely: when a spec issues two consecutive optimistic mutations on the same row (e.g. complete then reopen), it `await`s the first mutation's `POST` response before issuing the second click. Skipping this races the BE confirmation against the next optimistic write.

Concretely on `check()`/`uncheck()`: Playwright's "guard" methods retry until the post-condition is met. For mutations that may roll back (the error-recovery spec), use `.click()` instead — `.check()` would silently click again after the rollback and mask the test.

**6. Failure artefacts retained, success artefacts dropped.**

`trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'`, `video: 'retain-on-failure'`. Successful runs leave nothing behind so CI artefact storage stays cheap. Failed runs leave enough to reproduce locally (`npx playwright show-trace path/to/trace.zip` + the HTML report).

**7. Browser matrix: Chromium only by default.**

The FE has no platform-conditional code paths. Adding Firefox/WebKit triples runtime + artefact storage with negligible additional signal. The config reads a `PLAYWRIGHT_BROWSERS=chromium,firefox,webkit` env switch for opt-in widening; CI can flip it on per branch if a regression ever justifies the cost.

**8. The suite is a separate gate, not part of `npm run check`.**

`npm run check` (lint + typecheck + unit/component + bundle budget) runs in seconds and is the green-bar that every commit clears. `npm run test:e2e` requires Docker, runs the full stack, and takes longer (~5 s against a warm stack, longer cold). It belongs on a CI job that runs after `check` passes.

## Consequences

- **Positive:** The stack lifecycle "just works" whether you have it up or not. Seeding/cleanup is six lines of fixture code with no production-code coupling. Selectors are stable because they're driven by the named ARIA roles the FE components already expose. Failure surfaces are inspectable; success runs are silent. The browser matrix is opt-in for cost discipline.
- **Trade-off:** Serial execution is the price of a single shared BE database. With 12 specs running ~4-5 s, the cost is invisible; if the suite grows past ~50 specs, revisit per-worker DB isolation. The auto-detect path means a spec author can't trivially assert "the stack was owned by setup" — but that's exactly the point: the test contract is the running stack, not how it got there.

## Alternatives considered

- **Use Playwright's `webServer` config to spawn the stack** — rejected: built for single-process dev servers, not docker compose with healthchecks.
- **Per-worker DB isolation via separate compose stacks** — rejected: too much complexity for a 12-spec suite.
- **`data-testid` selectors** — rejected: the FE components already carry stable `aria-label` props that disambiguate every interactive element; mirroring those costs nothing and avoids a parallel test-only attribute surface.
- **Run E2E inside `npm run check`** — rejected: keeps the green-bar gate fast (seconds, no Docker required); E2E stays a separate CI job.

# Session 06 — Plan

**Owner:** E2E Suite (Playwright) — covers the critical user journeys end-to-end against the docker-composed stack.

**Inputs read:** `CLAUDE.md`, master plan, `handoffs/05-handoff.md` (especially the **User journeys** section), ADR-0011 (test strategy), ADR-0023 (FE proxy), ADR-0029 (FE production-readiness cleanup), `docker-compose.yml`, `nginx.conf`, the FE UI tree.

## Goals (definition of done, restated)

1. `npm run test:e2e` from a clean checkout boots the docker stack, runs the Playwright suite, tears the stack down, exits 0.
2. Three consecutive runs: zero flakes.
3. Failure surfaces are inspectable: trace + screenshot + video saved on failure; `npx playwright show-report` works.
4. `npm run check` still passes (E2E is intentionally **not** wired into `check` — it stays a separate, slower gate; ADR-0011 only required the unit/component layer in the green-bar gate).
5. ADR-0030 records the E2E conventions worth pinning.

## Workspace layout

A new workspace `packages/e2e` (added to root `package.json` `workspaces`):

```
packages/e2e/
  package.json
  playwright.config.ts
  tsconfig.json
  README.md                                    (short — full docs in repo README)
  playwright/
    global-setup.ts                            (boot stack if not running, wait for /readyz, stash teardown flag)
    global-teardown.ts                         (only tear down what global-setup brought up)
    fixtures.ts                                (extends `test` with apiClient + cleanDb autoFixture + seedTasks)
    pages/
      task-list.page.ts                        (small page object — only methods used in >1 spec)
  tests/
    smoke.spec.ts                              (initial render: heading, empty state, form is reachable)
    add-task.spec.ts                           (happy via Enter; happy via button; client-side empty validation; >200 char rejection)
    complete-reopen.spec.ts                    (mark complete; reopen; checkbox label flips)
    edit-task.spec.ts                          (Save updates row; Escape cancels with no PATCH)
    delete-task.spec.ts                        (delete + focus moves to next row's Delete button)
    error-recovery.spec.ts                     (server returns 500 → optimistic rollback + toast carries requestId)
```

Why a workspace and not a top-level `e2e/` folder: `npm install` already manages workspaces, the existing `npm run` machinery picks it up for free, and Playwright's deps are scoped to the package they belong to (rather than polluting the root). It also matches the style of `packages/backend` and `packages/frontend`.

## Stack management

The Playwright config uses **`globalSetup` + `globalTeardown`** (not `webServer`, which is meant for single-process dev servers, not docker compose).

- `global-setup.ts` does a quick `GET http://localhost:8081/healthz` + `GET http://localhost:8081/api/readyz`. If both succeed, it assumes the stack is already up (developer left it running) and exports `STACK_ALREADY_RUNNING=1` to env so teardown leaves it alone. Otherwise it spawns `docker compose up -d --wait --build` from the repo root, which blocks until both healthchecks report `healthy` (compose's `--wait` flag uses the existing `healthcheck` blocks — no polling code needed).
- `global-teardown.ts` runs `docker compose down -v` only if setup brought the stack up. The `-v` flag drops the `todolist-data` volume so the next run starts from a known empty state.

Required executables: `docker` and `docker compose` v2. The setup probes both with `docker compose version` and fails fast with a helpful error if missing.

The base URL is hard-coded to `http://localhost:8081` (the FE container that proxies `/api/*` to the backend) — no env override needed, since the suite is purpose-built for the compose topology.

## Seeding strategy

**Per-test isolation via the API**, not by recycling containers.

- An `autoUse` fixture `cleanDb` runs before every test: `GET /api/tasks` → `DELETE /api/tasks/:id` for each id. O(n) on the existing list; the suite never builds up more than ~5 tasks per test, so this is cheap and bullet-proof.
- A `seedTasks(titles: string[])` fixture posts tasks via `POST /api/tasks` and returns the created `Task[]` (server-issued ids, timestamps). Tests that need a starting state call it explicitly.
- All HTTP goes through Playwright's built-in `request` fixture (`page.request`) so requests pick up the same proxy + cookie context as the page. No separate fetch implementation.

Rejected: per-test `docker compose down -v` + `up -d --wait` — adds ~10 s per test, kills parallelism, no benefit when API-level cleanup is honest.

Rejected: a dedicated `POST /test/reset` route on the BE — pollutes production code with a test-only surface; ADR-0017 (Result over exceptions) would force us to design the response shape too. Not worth it when 6 lines of fixture code do the job.

## Page object boundary

A single thin page object `task-list.page.ts` exposing the locators that show up in >1 spec:

```ts
class TaskListPage {
  constructor(readonly page: Page) {}
  readonly addInput   = this.page.getByRole('textbox', { name: 'New task title' });
  readonly addButton  = this.page.getByRole('button',  { name: 'Add task' });
  readonly tasksList  = this.page.getByRole('list',    { name: 'Tasks' });
  readonly toasts     = this.page.getByRole('region',  { name: 'Notifications' });
  row(title: string) {
    return this.tasksList.getByRole('listitem').filter({
      has: this.page.getByText(title, { exact: true }),
    });
  }
  checkboxFor(title: string, target: 'completed' | 'pending') {
    return this.page.getByRole('checkbox', { name: `Mark "${title}" as ${target}` });
  }
  editButton(title: string)   { return this.page.getByRole('button', { name: `Edit "${title}"` });   }
  deleteButton(title: string) { return this.page.getByRole('button', { name: `Delete "${title}"` }); }
  async goto() { await this.page.goto('/'); await this.tasksList.or(this.page.getByText('No tasks yet')).waitFor(); }
}
```

Anything more elaborate (helpers that wrap multiple actions) gets inlined — page objects earn their place when locators repeat, not when actions repeat.

## Wait strategy

In order of preference:
1. **Locator auto-wait** (`expect(locator).toBeVisible()`, `toBeChecked()`, `toBeFocused()`, etc.). Default for everything.
2. **`page.waitForResponse(/\/api\/tasks\b/)`** when a test asserts post-server state (e.g. after a delete, before navigating away — useful for the rare timing-sensitive case).
3. **`expect.poll(...)`** only when neither of the above fits (e.g. asserting a toast count after multiple async events).

**No `page.waitForTimeout`. No `page.waitForLoadState('networkidle')`** — both are flaky and indicate a missing assertion.

Optimistic-state caveat (handoff-05 §gotchas): assertions on user-perceptible state land *immediately* on the optimistic UI write — that's correct. Tests that need the *server-confirmed* state (e.g. "row carries the server-issued createdAt") wait on the `GET /api/tasks` invalidation refetch via `page.waitForResponse`.

## Browser matrix

**Chromium only by default.** Reasoning:
- The FE has no platform-conditional code paths.
- Firefox/WebKit add ~2× runtime + 2× artefact storage with negligible additional signal.
- A future CI matrix can opt into them via a `PLAYWRIGHT_BROWSERS=chromium,firefox,webkit` env switch (one line in the config).

## Failure artefacts

Per `playwright.config.ts`:
```ts
use: {
  baseURL: 'http://localhost:8081',
  trace:      'retain-on-failure',
  screenshot: 'only-on-failure',
  video:      'retain-on-failure',
},
expect: { timeout: 5_000 },
reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
forbidOnly: !!process.env.CI,
retries:    process.env.CI ? 2 : 0,
workers:    process.env.CI ? 1 : undefined,
```

Local default is zero retries: a test that needs a retry to pass is a bug we want to feel. CI gets two retries to absorb genuinely-flaky network/docker hiccups; that's a Session-7 concern but the config bakes the right shape now.

## Specs (one per critical user journey)

| Spec | Journey covered (handoff-05 numbering) | Notes |
|---|---|---|
| `smoke.spec.ts` | App boots; empty state visible; AddTaskForm reachable | Sanity probe. |
| `add-task.spec.ts` | (1) happy via Enter, (1') happy via button click, (2) client-side empty validation, (3) >200 char server rejection | The 400 path is tiny and worth pinning — the toast must carry a `requestId`. |
| `complete-reopen.spec.ts` | (4) mark complete, (5) reopen | Asserts `toBeChecked` + the label flip. |
| `edit-task.spec.ts` | (6) Save, (7) Escape cancels (no PATCH) | The "no PATCH" half is asserted by counting `page.waitForRequest` matches against `PATCH /api/tasks/*` — must be zero. |
| `delete-task.spec.ts` | (8) delete + focus moves | Uses `expect(nextDeleteBtn).toBeFocused()` after a `requestAnimationFrame` lands. |
| `error-recovery.spec.ts` | (9) server failure rolls back optimistic change | `page.route('**/api/tasks/*/complete', r => r.fulfill({ status: 500, body: errorEnvelope }))` simulates a transient server error without bouncing the BE container. |

**Skipped from handoff-05's list:**
- (10) "Reload preserves state" — a property of the BE (volume persistence) already covered by integration tests; an E2E re-run would rebuild the stack anyway.
- (11) "Keyboard-only flow" — the individual keyboard interactions (Enter to add, Escape to cancel, Space to toggle checkbox) are covered inline in the per-feature specs above; a dedicated keyboard-only spec would duplicate setup without revealing new behaviour.

Each spec is **independent**: the `cleanDb` autofixture wipes between tests; tests can run in parallel and in any order.

## Scripts

Root `package.json` updates:
```json
"test:e2e":         "npm run test --workspace @todolist/e2e",
"test:e2e:headed":  "npm run test:headed --workspace @todolist/e2e",
"test:e2e:ui":      "npm run test:ui --workspace @todolist/e2e",
"test:e2e:report":  "npm run report --workspace @todolist/e2e"
```

`packages/e2e/package.json`:
```json
{
  "name": "@todolist/e2e",
  "private": true,
  "type": "module",
  "scripts": {
    "test":         "playwright test",
    "test:headed":  "playwright test --headed",
    "test:ui":      "playwright test --ui",
    "report":       "playwright show-report",
    "typecheck":    "tsc --noEmit",
    "install-browsers": "playwright install chromium"
  },
  "devDependencies": {
    "@playwright/test": "^1.51.0",
    "@types/node": "^24.12.2"
  }
}
```

`npm install` from the repo root installs the workspace deps. Playwright's browser binary needs a one-off `npx playwright install chromium` (or `npm run install-browsers --workspace @todolist/e2e`) — the README documents this and `global-setup.ts` fails fast with the right message if Chromium is missing.

## ADR

**ADR-0030 — E2E conventions (Playwright + docker compose).** Pins:
- The stack lifecycle is owned by `globalSetup`/`globalTeardown`, with auto-detection of an externally-managed stack.
- Per-test isolation is API-driven, not container-driven.
- Selectors are role-based (no `data-testid`); the FE selectors are stable because they originate from `aria-label` props the components own.
- `waitForTimeout` and `waitForLoadState('networkidle')` are banned.
- Failure artefacts are kept; success artefacts are dropped (CI cost discipline).
- Browser matrix defaults to Chromium; widening is opt-in via env.

## Out of scope (per the prompt)

- README polish beyond the E2E section.
- CI workflow files (Session 7).
- Observability hooks for the suite.
- BE/FE source changes (the suite must work against the existing build; no test-only routes, no extra `data-testid`).

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| `docker compose up --build` is slow on the first run, causing the first `test:e2e` invocation to look hung | `--wait` makes it block on healthchecks, not on a fixed sleep; setup logs `"booting stack…"` so the user sees progress; subsequent runs reuse the built image. |
| Optimistic UI flake (toast asserted before `GET /tasks` invalidation refetch) | Either assert on the user-perceptible state (which is the optimistic state), or `await page.waitForResponse(/\/api\/tasks(\?|$)/)` after the action. |
| Chromium browser binary missing on a fresh machine | `global-setup.ts` checks for the binary up front and prints the exact `npx playwright install chromium` command. README documents the same. |
| Bundle/build cache stale because the FE Dockerfile copies source post-`npm ci` | Already the case in the existing Dockerfile; `--build` in setup catches the diff. |
| Suite hangs on a Playwright `waitFor*` if the stack health flips while the test is mid-action | `expect()` timeout is 5 s; per-test default timeout is 30 s (Playwright default). A truly-broken stack fails the whole suite within a minute, not silently. |

## Estimated runtime

~7 specs × ~2-4 assertions each, ~3-4 actions per spec, parallel by file. Rough estimate: **30-60 s** including stack boot (cached image) and teardown. First-ever run with `--build` from cold: ~2-3 min.

## Handoff content (preview)

- Total runtime measured across 3 consecutive runs.
- Any spec that needed a retry locally — there should be none; if there were, document why.
- Notes for Session 7: CI considerations (retries, parallelism, browser-matrix env, artefact upload, where to wire `npm run test:e2e` in the GitLab pipeline).

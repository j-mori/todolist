# @todolist/e2e

Playwright E2E suite for the to-do-list reference app. Drives the docker-composed stack (BE on `:3000`, FE-with-nginx-proxy on `:8081`) through the same code paths a real user would.

See [ADR-0030](../../docs/decisions/0030-e2e-conventions.md) for the conventions.

## Prerequisites

- Node 24+, npm 11+ (managed by the repo root).
- Docker + Docker Compose v2 on the `PATH`.
- The Chromium binary (one-off):

  ```bash
  npm run install-browsers --workspace @todolist/e2e
  # equivalent to: npx playwright install chromium
  ```

## Run

From the repo root:

```bash
npm run test:e2e               # boot stack if not running, run suite, tear down
npm run test:e2e:headed        # show the browser window while running
npm run test:e2e:ui            # open Playwright's UI mode
npm run test:e2e:report        # open the last HTML report
```

The `globalSetup` probes `:8081/healthz` + `:8081/api/readyz` first. If both succeed, it assumes a developer-managed stack is running and skips both `up` and the matching `down -v` in teardown. Otherwise it runs `docker compose up -d --wait --build` from the repo root and `docker compose down -v` afterwards.

## Browser matrix

Chromium-only by default. To widen:

```bash
PLAYWRIGHT_BROWSERS=chromium,firefox,webkit npm run test:e2e
```

## Per-test isolation

Every test starts with an empty BE database. The `cleanDb` autoFixture in `playwright/fixtures.ts` enumerates `GET /api/tasks` and issues a `DELETE` for each. Tests that need pre-populated state call `seedTasks(['title 1', 'title 2'])`.

## Debug a failure

The HTML report keeps trace + screenshot + video for failed runs:

```bash
npm run test:e2e:report
```

Or open a specific trace:

```bash
npx playwright show-trace packages/e2e/test-results/<test>/trace.zip
```

## Selectors

Role-based, mirroring the `aria-label` props the FE owns. Never `data-testid`. The `TaskListPage` page object in `playwright/pages/task-list.page.ts` exposes the locators that show up in more than one spec.

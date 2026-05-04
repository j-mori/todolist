# ADR-0031: GitLab CI as the pipeline platform

**Status:** accepted
**Date:** 2026-05-05
**Session:** 07

## Context

The first six sessions shipped the application; CI was deferred to Session 7 with no hard constraint on the platform. The repo's git origin (when one is set) targets `gitlab.molops.io`, the team's pipeline experience is on GitLab, and the project is meant to slot into Mollie's existing tooling without bespoke handling.

The pipeline must:
- Gate every push and merge request on lint, types, layer rules, tests, and bundle budgets.
- Run the Playwright suite against the docker-composed stack, exercising the cold-boot path that local sessions skipped (handoff-06).
- Cache Node deps and the Playwright browser binary so cold pipelines stay under a minute and warm pipelines stay under thirty seconds.
- Keep failure artifacts (Playwright trace, screenshots, video) without paying for success-run uploads.
- Be readable enough that an engineer can recreate every step on their laptop with a copy-paste.

## Decision

Use **GitLab CI** (`.gitlab-ci.yml` at the repo root), with three stages run in this order: `check → build → e2e`.

- **`check`** — `lint`, `typecheck`, `layers`, `test` as four parallel jobs on `node:24-alpine`. All four must pass before `build` runs.
- **`build`** — produces FE + BE bundles, exposes them as artifacts. Bundle-size gate runs here as a separate job that depends on `build`.
- **`e2e`** — Playwright on the official `mcr.microsoft.com/playwright:v1.51.0-jammy` image with a `docker:25-dind` service. Caches `~/.cache/ms-playwright` per branch so Chromium isn't re-downloaded on every run. Failure-only artifact upload of `packages/e2e/playwright-report/` and `packages/e2e/test-results/`.

Every job runs `npm ci --prefer-offline --no-audit --no-fund` in `before_script`, with `node_modules` and `.npm` cached on `package-lock.json`.

The pipeline does not push, deploy, or notify — those are out of scope for a personal showcase repo.

## Consequences

- **Positive:** Two independent paths by cost: cheap (`check`) and expensive (`e2e`). Engineers can mirror the cheap path locally with `npm run check`; the e2e job exercises the cold-boot path that local sessions skip. The single-file pipeline reads top-to-bottom; no hidden includes or templates.
- **Trade-off:** `dind` requires a privileged GitLab runner. Mollie's shared runners support this; if the repo ever moves to a sandbox without it, switch the e2e job to a runner with native Docker.
- **Follow-up:** A nightly job widening the browser matrix (`PLAYWRIGHT_BROWSERS=chromium,firefox,webkit npm run test:e2e`) is documented but not wired — handoff-06 noted the cost trade-off. Add when there's a real cross-browser regression to chase.

## Alternatives considered

- **GitHub Actions** — rejected: the repo's intended home is GitLab; using GHA would force a dual-remote setup with no upside. The `gitlab-ci.yml` is small enough to port if the calculus ever changes.
- **A single mega-job that runs everything** — rejected: failure attribution and parallelism both suffer; the cheap-vs-expensive split is the whole reason the pyramid exists.
- **Custom Docker base image with the toolchain pre-installed** — rejected: caching `node_modules` against the lockfile gets us most of the way for none of the maintenance cost. Revisit only if cold-cache pipelines become a real bottleneck.
- **Skipping `e2e` on every push, running only on `main`** — rejected: defeats the point of the pyramid; the suite is intentionally fast (~30s warm) so it can run per-pipeline.

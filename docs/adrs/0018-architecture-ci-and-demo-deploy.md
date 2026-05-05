# ADR-0018: GitHub Actions CI and MSW-backed GitHub Pages demo

**Status:** accepted
**Date:** 2026-05-06

## Context

The repo is being published on GitHub as a public reference. Until now it ran no CI, and there is no live artefact a reader can click on to see what the project does. Two needs collide:

1. A green-bar CI gate on every PR — lint, typecheck, layer rules, unit + integration + component tests, FE build with bundle budget, and full Playwright E2E against the docker-composed stack. Same gate on `main`.
2. A free, always-up live demo of the frontend. Anyone reading the README should be able to click a link and use the app.

The constraint is **free**. No paid runners, no PaaS subscriptions. Public repos on `ubuntu-latest` get unlimited GitHub Actions minutes; GitHub Pages is free for public repos.

The honest tension: GitHub Pages is static-only. It cannot host the Hono backend the FE talks to over `/api`. Three options were on the table:

1. Deploy the bundle as-is. Page loads, every API call hits the existing error UI. The showcase looks broken — a worse-than-nothing demo.
2. Host the backend on a free PaaS (Render, Fly.io free tier). Cold starts, runtime monitoring, free tiers that change. "Free" becomes a maintenance promise, not a property of the repo.
3. Ship the demo with **Mock Service Worker** (MSW) intercepting `/api/*` in the browser. The app runs end-to-end against an in-memory store seeded at boot. No backend needed. MSW is the modern standard for this exact problem.

## Decision

**One workflow at `.github/workflows/ci.yml`** runs on `pull_request` and `push: main`. Five jobs:

- `quality` — `npm run lint && npm run typecheck && npm run check:layers`
- `test` — `npm run test` (BE node:test + FE Vitest + shared)
- `build` — `npm run build && npm run check:bundle-size` (asserts JS ≤ 110 kB / CSS ≤ 8 kB gzipped)
- `e2e` — Playwright against `docker compose up --build`. Caches `~/.cache/ms-playwright` keyed on `package-lock.json`. Uploads `playwright-report/` on failure.
- `deploy` — `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`, `needs: [quality, test, build, e2e]`. Builds the demo, copies `index.html` to `404.html` for SPA routing, publishes via `actions/deploy-pages@v4` to `https://j-mori.github.io/todolist/`.

Workflow-level `concurrency: cancel-in-progress: true` cancels superseded PR pushes. The `deploy` job overrides this with `concurrency: { group: pages, cancel-in-progress: false }` so an in-flight Pages publish is never cancelled mid-upload.

**The demo bundle is built with MSW enabled, gated by `VITE_DEMO_MODE=true`.** A new root script `build:demo` runs `VITE_DEMO_MODE=true npm run build --workspace @todolist/frontend -- --base=/todolist/`. At runtime, `main.tsx` checks `import.meta.env.VITE_DEMO_MODE === 'true'` and dynamically imports `./mocks/browser.ts` only then. Vite tree-shakes the MSW chunk out of the regular production bundle (verified: regular build is 89 kB gzipped vs demo build with a separate `browser-*.js` chunk).

Handlers in `src/mocks/handlers.ts` mirror the BE's eight routes and use the Zod schemas from `@todolist/shared` for response shapes, so the wire contract stays in sync. The store is a `Map<string, Task>` seeded with five sample tasks; resets on page reload, which is the right behaviour for a demo.

## Consequences

- **Positive — clickable showcase.** A reader visits `j-mori.github.io/todolist/` and uses the actual app. No screenshots, no caveats.
- **Positive — single CI gate.** PR and main run the same five-job pipeline. Deploy is a sixth job that requires all four CI jobs green; impossible for a broken build to publish.
- **Positive — zero ongoing cost or maintenance.** No PaaS account to forget about, no cold start, no dashboards to monitor. Public repo + Pages = free, forever.
- **Positive — production parity preserved.** The demo build path is the only build that ships MSW. `npm run build` (used by the FE Docker stage and by `npm run check`) doesn't include MSW — verified by the bundle-size budget passing on the regular build.
- **Trade-off — MSW handlers must track BE behaviour.** When a BE endpoint changes status codes, headers, or error shapes, the MSW handlers in `src/mocks/handlers.ts` need the same change. Mitigation: handlers import the shared Zod schemas, so payload shape drift is type-checked at build time. Status codes and validation rules need manual sync, but the surface is small (8 routes) and the contract is stable.
- **Trade-off — top-level await in `main.tsx`.** The MSW worker must register before React mounts so the first request from the app is already intercepted. Top-level await is supported in ES2022+ and Vite handles it natively; the regular build path executes the early-return branch synchronously.
- **Follow-up — Pages source.** GitHub Pages must be enabled once at repo Settings → Pages → Source: "GitHub Actions". Captured in the README's deployment section.

## Alternatives considered

- **No live deploy** — rejected. A reference repo with no clickable demo is half-finished. The brief explicitly asked for one.
- **Backend on free PaaS (Render / Fly.io / Koyeb free tier)** — rejected. Free tiers change terms, cold-start to multi-second wakeup, and require an external account whose credentials someone has to rotate. Adds a maintenance commitment for a static showcase.
- **Static bundle with broken API calls** — rejected. The first thing a visitor sees is the error UI. Worse than not deploying at all.
- **MSW always on** — rejected. Forces the production Docker bundle to ship the MSW worker (~90 kB gzipped) and registers a service worker that intercepts every fetch. The gate flag keeps demo concerns out of prod.
- **Two separate workflows (`ci.yml` + `deploy.yml` with `workflow_run`)** — rejected. The `workflow_run` trigger executes in the context of the default branch's workflow file (security feature) and adds a perceptible delay between CI green and deploy start. A single workflow with a `needs:`-gated deploy job is simpler and faster.
- **Build matrix across Node versions** — rejected. The repo pins `engines.node: '>=24.0.0'`. Testing on older Node would test something we don't ship; testing on newer Node every week is noise. One job, Node 24, fast.

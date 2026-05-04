# ADR-0029: Frontend production-readiness cleanup — strict typing, env-driven config, request cancellation, security headers, bundle budgets

**Status:** accepted
**Date:** 2026-05-04
**Session:** 05 (post-review audit)

## Context
A code-review pass on the Sessions 4 + 5 frontend surfaced an 11-item gap between "tests pass" and "production-ready, state-of-the-art TypeScript 2026". The items individually ranged from minor (`as string` cast, dead inline styles) to load-bearing (a notifications-timer bug that could let success toasts live forever, a hardcoded dev proxy target, missing security headers). Treated together they constituted enough drift to warrant an ADR pinning the conventions so future sessions don't reintroduce the same shapes.

## Decision

This ADR records a single audit pass that closes every gap and the conventions the audit established.

**1. No type casts on the production path. None in tests beyond a single typed alias.**

`as unknown as typeof fetch`, `as RequestInfo`, `as string` and friends are gone from `packages/frontend/src/`. Where Vitest mocks need to satisfy `typeof fetch`, tests use `vi.fn<FetchImpl>()` with an explicit `type FetchImpl = typeof fetch` alias. Where a `Request` constructor needs to accept `RequestInfo | URL`, the helper `toRequest(input, init)` discriminates on `instanceof Request` instead of casting. The `pending.nextId as string` in `<TaskList />`'s focus-management `useEffect` is replaced by destructuring into a const that TS narrows naturally.

**2. Configuration is env-driven, with a documented default in code only at the boundary.**

`vite.config.ts` reads `VITE_DEV_PROXY_TARGET` via `loadEnv(mode, …)` and falls back to `http://localhost:3000` only after that lookup. The default is documented in `packages/frontend/.env.example` next to the existing `VITE_API_BASE_URL`. No production code path ever embeds a hardcoded host:port.

TanStack Query's defaults move out of `main.tsx` into `application/queries/query-client-config.ts` as a named `QUERY_CLIENT_DEFAULTS: QueryClientConfig`. Each value is annotated with the rationale for picking it. `main.tsx` becomes `new QueryClient(QUERY_CLIENT_DEFAULTS)`.

**3. Request cancellation end-to-end (`AbortSignal`).**

`HttpRequest<T>` carries an optional `signal`. `tasksApi`'s methods accept a `RequestOptions` object that includes the signal. `useTasksQuery`'s `queryFn` receives the signal from TanStack Query (`{ signal }`) and threads it into `tasksApi.list({ signal })`. An unmounted query now actually aborts its in-flight fetch instead of letting it run to completion and discarding the result.

**4. Hexagonal split inside `application/queries/`.**

`mutation-helpers.ts` previously mixed pure helpers (`unwrap`, `cancelAndSnapshotList`, `writeOptimisticList`, `rollbackList`, `invalidateList`) with a React hook (`useNotifyMutationError`). The hook moves to its own file `use-notify-mutation-error.ts`. Pure helpers stay free of React imports, which keeps them trivially unit-testable and avoids dragging React into anything that imports from `mutation-helpers.ts`.

**5. The auto-dismiss timer tracks per-id.**

The Session-5 `useAutoDismiss` cleared and re-created every success-notification timer on every queue change. A new notification arriving 2 s after a success entered would reset that success's TTL, potentially indefinitely. `useAutoDismiss` now keeps a `Map<id, Timeout>` and only schedules a timer for ids it hasn't seen before. A regression test (`NotificationsViewport.test.tsx`: "does not reset an in-flight TTL when an unrelated notification arrives") pins the behaviour.

**6. Stable callback refs.**

`<TaskList />`'s `Populated` no longer creates a fresh `(id) => (el) => …` factory on every render (which churned ref entries). The `<TaskRow />` `Delete` button carries a `data-task-id` attribute; a single `useCallback`-stable `setDeleteButtonRef` reads the id from the element. A separate `useEffect` sweeps stale entries when the task list changes.

**7. Inline `style={{...}}` is gone.**

The Session-5 markup carried 22 inline `style={{borderColor:'var(--color-border)',background:'var(--color-surface)',...}}` sites that bypassed Tailwind. With the design tokens declared via `@theme` in `theme.css`, Tailwind v4 generates the matching utilities (`bg-surface`, `text-fg-muted`, `border-border`, `bg-danger-bg`, `text-danger`, `bg-primary`, `text-primary-fg`, etc.). Every UI component now uses those utilities; a tiny `cn(...values)` helper joins conditional class strings. The bundle CSS grew by ~0.6 kB gzipped (3.28 kB total) — a fair trade for grep-able single-source-of-truth styling and dark-mode-by-tokens for free.

**8. nginx security headers (defence-in-depth at the edge).**

`packages/frontend/nginx.conf` adds:
- `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin`
- `server_tokens off;`

CSP keeps `'unsafe-inline'` for styles (React's runtime occasionally injects inline style attrs from third-party libs we may add later; the actual XSS vector is `script-src`, which is `'self'` only). Headers re-declared in every location block — nginx's `add_header` does not inherit once any block redeclares headers. `proxy_pass /api/` to the BE container preserves the same headers in front of the API responses too.

**9. Bundle-size budget enforced in CI.**

`scripts/check-bundle-size.mjs` walks `packages/frontend/dist/assets/` and asserts gzipped sizes against per-extension budgets (currently `js: 110 kB`, `css: 8 kB`). Wired into the green-bar gate as `npm run check:bundle-size`, included in `npm run check`. Bumping a budget is a one-line change with a commit-message rationale — visible in code review.

## Consequences

- **Positive:** No casts on the production path. No hardcoded host:ports. In-flight fetches abort on unmount. The notifications timer is robust against rapid queue changes. UI styling is token-driven through Tailwind, with no inline-style escape hatches. The FE container ships with conservative security headers out of the box. Bundle regressions fail the green-bar gate, not a manual eyeball on `vite build` output.
- **Trade-off:** The audit added ~0.6 kB gzipped CSS (more utilities surfaced from `@theme`). The bundle-size script adds ~1 s to `npm run check` (the build step). The single `setDeleteButtonRef` pattern relies on a `data-task-id` attribute on the Delete button — a small contract between `<TaskList />` and `<TaskRow />`, documented in code.
- **Follow-up:** None mandatory. Possible future polish: tighten CSP to `style-src 'self'` once we have a guarantee no library injects inline styles; introduce CSP `report-uri` once a reporting endpoint exists; add per-mutation `AbortSignal` plumbing for mutations that could outlive the originating component.

## Alternatives considered

- **Keep the `as unknown as typeof fetch` casts** — rejected. Vitest 1+ supports `vi.fn<T>()`; the cast was vestigial.
- **Hardcode the dev proxy target with a code comment** — rejected. Env-driven config is the project standard (BE's `loadConfig` was hardened in ADR-0022 with the same principle); the FE should follow.
- **Use `useOptimistic` (React 19) for notifications timers instead of `useEffect` + `Map`** — rejected. `useOptimistic` is for server-state mirrors, not timers; the explicit `Map<id, Timeout>` is the textbook pattern.
- **Defer security headers to a future Session-7 polish ADR** — rejected. CSP is part of the deployable artifact (`nginx.conf`), not polish; shipping without it would have meant releasing a measurably weaker container.
- **Skip the bundle-size budget until CI exists** — rejected. The script is 50 LoC and runs locally as part of `npm run check`. CI integration is trivial when CI lands.

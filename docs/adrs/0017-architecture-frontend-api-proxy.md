# ADR-0017: Same-origin `/api` via reverse proxy (nginx in prod, Vite in dev)

**Status:** accepted
**Date:** 2026-05-06

## Context

The browser needs to reach the backend API. Three shapes are viable:

1. The FE bundle calls **absolute URLs** (`https://api.example.com/tasks`) with the host injected at build time via `VITE_API_BASE_URL`.
2. The FE bundle calls **relative paths** (`/api/tasks`); a reverse proxy in front of the static assets rewrites `/api/*` to the backend.
3. **Co-serve**: a single backend serves both the SPA and the API on the same origin — no proxy needed.

Option 3 couples FE/BE deploy cycles and prevents independent scaling, which conflicts with [ADR-0011](0011-architecture-container-strategy.md) (per-package multi-stage Docker). The real choice is between 1 and 2.

## Decision

Use **option 2**. The FE always calls `/api/...` (relative). A reverse proxy strips the `/api/` prefix and forwards to the backend.

**Production — nginx inside the FE container** (`packages/frontend/nginx.conf`):

```nginx
location /api/ {
  proxy_pass http://backend:3000/;   # trailing slash strips the /api/ prefix
}
```

**Dev — Vite dev server** (`packages/frontend/vite.config.ts`):

```ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      rewrite: (path) => path.replace(/^\/api/, ''),
    },
  },
},
```

Same path, same rewrite contract, two implementations. The bundle never resolves `/api` itself — whatever sits in front of the bundle decides where it lands.

`VITE_API_BASE_URL` still exists as a build-time escape hatch (defaults to `/api`) for unusual deployments where no proxy is available. It is not the default path.

## Consequences

- **Positive — no CORS.** Same-origin requests don't trigger preflights. The BE doesn't have to maintain an allow-list of FE origins per environment.
- **Positive — one bundle, many environments.** Vite envs are baked into JS at build time. With absolute URLs, `dev`/`staging`/`prod` each need their own Docker image. Same-origin means one immutable artifact promoted across environments; the proxy decides where `/api` lands.
- **Positive — cookies and CSP stay simple.** First-party cookies and `connect-src 'self'` work same-origin without ceremony. Cross-origin would require `credentials: 'include'` on every fetch, `Access-Control-Allow-Credentials` on the BE (no wildcard origin allowed with credentials), and the API host added to CSP.
- **Positive — dev mirrors prod.** Both modes call `/api`. Bugs that only manifest same-origin (cookie scope, CSP violations, redirect handling) reproduce locally.
- **Trade-off — two proxy configs to keep in sync.** nginx and Vite each carry a `/api` rewrite rule; they could drift if someone edits one without the other. Mitigation: BE integration tests hit the bare backend paths (e.g. `/tasks`), and the E2E suite drives the docker-composed stack with nginx in the loop, so both paths get exercised in CI.
- **Trade-off — extra hop in prod.** Sub-millisecond on a colocated container. Not measurable.
- **Follow-up:** none.

## Alternatives considered

- **Absolute URL via `VITE_API_BASE_URL`** — rejected. Forces CORS, per-environment bundles, a more involved cookie/CSP story, and breaks dev/prod parity (see Consequences for the full list of costs).
- **Co-serve SPA + API from a single backend** — rejected. Couples FE and BE deploy cycles, and conflicts with ADR-0011 (per-package containers, independent scaling).
- **Service worker as the proxy** — rejected. Adds a registration cliff (first load misses it), does nothing for local dev, and reaches for a heavyweight tool to solve a routing problem.

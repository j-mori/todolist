# ADR-0023: FE → BE traffic via same-origin `/api` proxy in dev (Vite) and prod (nginx)

**Status:** accepted
**Date:** 2026-05-04
**Session:** 04

## Context
The FE needs to reach the BE in two environments:
- **Dev:** `npm run dev` runs Vite on `:5173` and the BE on `:3000`. Cross-origin by default.
- **Prod (Docker):** the FE container serves a static bundle through nginx on `:8081`; the BE container exposes Hono on `:3000`. Cross-origin by default; would also require a hostname known to the bundle at build time.

We considered three positions:

1. **Direct + CORS.** The bundle imports `import.meta.env.VITE_API_BASE_URL` (e.g. `http://localhost:3000`); the BE allows the FE origin via `CORS_ORIGIN`. Works, but: hostnames leak into the bundle, dev and prod URLs differ, and every mutation hits a CORS preflight (PATCH/DELETE/`content-type: application/json`). One misconfigured env or one extra header is a class of bug we don't need to ship.
2. **BE mounts everything under `/api`.** The Hono routes change from `/tasks` to `/api/tasks`. A clean RESTful surface picks up an arbitrary prefix that exists only because of frontend deployment topology. Couples the wire contract to the deployment.
3. **Reverse proxy on the FE side, in both environments.** The FE talks to a relative `/api/...` URL. In dev, Vite's `server.proxy` rewrites it to `http://localhost:3000`. In prod, nginx rewrites it to `http://backend:3000` (Docker DNS). Same path in both environments; CORS surface is empty.

## Decision
Adopt **(3)**. The FE's typed HTTP client uses a base URL of `/api` by default, configurable via `VITE_API_BASE_URL` at build time. The BE keeps its bare `/tasks` routes — the proxy strips the prefix.

```ts
// packages/frontend/vite.config.ts
server: {
  host: '0.0.0.0',
  port: 5173,
  proxy: {
    '/api': { target: 'http://localhost:3000', changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') },
  },
},
```

```nginx
# packages/frontend/nginx.conf
location /api/ {
  proxy_pass http://backend:3000/;        # trailing slash strips /api
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

`VITE_API_BASE_URL` is documented in `packages/frontend/.env.example` as defaulting to `/api`. Override it only for unusual deployments (e.g. embedding the FE in a host that can't proxy).

The BE's `CORS_ORIGIN` env stays in place — it's still useful for non-proxy dev workflows and for direct-curl debugging — but the proxy strategy means the FE container itself never triggers a CORS check.

## Consequences
- **Positive:** Zero CORS surface in either supported environment. No bundle-baked hostnames. Dev and prod URL paths are byte-identical, which kills a class of "works in dev, breaks in prod" bugs and lets the same `fetch` code paths run in tests, dev, and prod. The BE wire contract stays free of frontend deployment concerns.
- **Trade-off:** The path the BE sees (`/tasks`) differs from the path the browser sees (`/api/tasks`). Anyone reading server logs has to know the proxy strips the prefix. Acceptable; documented here and in `nginx.conf` and `vite.config.ts` next to the rewrite rule.
- **Follow-up:** If we ever embed the FE in a host that can't proxy, the build-time `VITE_API_BASE_URL` escape hatch covers it without re-architecting.

## Alternatives considered
- **Direct + CORS** — rejected: see Context (1). Brings preflights and bundle-baked hostnames for no benefit.
- **BE mounts under `/api`** — rejected: leaks deployment topology into the wire contract; ADR-0018 deliberately keeps action endpoints under bare `/tasks/...`.
- **A separate, third gateway service in compose** — rejected: solves the same problem with another container. nginx already runs in the FE pod; reusing it costs nothing.

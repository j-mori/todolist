# ADR-0012: Per-package multi-stage Docker + root compose

**Status:** accepted
**Date:** 2026-05-04
**Session:** 01

## Context
The brief requires the app to be runnable end-to-end via Docker. Two viable shapes: (a) a single Docker image bundling both BE and FE behind one server, or (b) one image per package, orchestrated by `docker-compose`. (a) is simpler but conflates concerns and prevents independent scaling/deployment; (b) reflects how the app would actually run in production.

## Decision
**Per-package multi-stage Dockerfile**, orchestrated by a root `docker-compose.yml`:

- `packages/backend/Dockerfile` — builder stage uses `node:24-alpine` to `npm ci --include=dev` and run `tsc`. Runtime stage uses `node:24-alpine` with production-only deps, `USER node`, healthcheck on `GET /health`, exposes port 3000.
- `packages/frontend/Dockerfile` — builder stage runs `vite build`. Runtime stage uses `nginx:1.27-alpine` with a custom `nginx.conf` that handles SPA fallback to `index.html` and exposes a `/healthz` endpoint, on port 80.
- `docker-compose.yml` — both services on a shared bridge network. Frontend depends on backend's healthcheck. Backend on host port 3000; frontend on host port 8081 (8080 was already taken by Docker Desktop on the dev machine).

Build context is the repo root (so `package-lock.json` and the `packages/shared` workspace are available); `.dockerignore` excludes `node_modules`, `dist`, `.git`, docs.

## Consequences
- **Positive:** Slim runtime images (Alpine, no dev deps). Independently buildable services. Healthchecks gate startup ordering. The "production" runtime closely mirrors how a real deployment would work.
- **Trade-off:** Two Dockerfiles to maintain. Build time is ~10s for the BE and ~15s for the FE on a warm cache — acceptable.
- **Follow-up:** Session 3 adds a SQLite volume to the backend service. Session 7 considers a non-root frontend image and tighter security headers in `nginx.conf`.

## Alternatives considered
- **Single combined image** — rejected: conflates concerns and prevents the FE/BE from being scaled or deployed independently.
- **Distroless instead of Alpine** — rejected: marginal security gain at this scope; Alpine images keep wget/sh available for healthchecks and shell debugging.
- **Bun runtime image** — rejected: per ADR-0002 we target Node.

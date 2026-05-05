---
name: todolist:setup
description: Bootstrap the todolist dev environment from scratch. Checks prerequisites, installs deps, copies .env, runs the green-bar gate, and offers to start the dev server. Use when setting up after a fresh clone or when the environment feels broken.
user-invocable: true
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
---

# Todolist — environment bootstrap

Walk the user through a complete local setup in order. Stop and report clearly if any step fails; do not paper over errors.

## Step 1 — Prerequisites

Check each tool and its minimum version:

| Tool | Minimum | Command |
|---|---|---|
| Node.js | 24.0.0 | `node --version` |
| npm | 11.0.0 | `npm --version` |
| Docker | any | `docker info` |
| Docker Compose | any | `docker compose version` |

For each failure print the exact version found (or "not found") and the install hint:
- Node/npm: https://nodejs.org (use `nvm` or `fnm` to manage versions)
- Docker: https://docs.docker.com/get-docker/

If Node or npm is below the minimum, stop — nothing else will work.

## Step 2 — Install workspace dependencies

```bash
npm install
```

This installs all workspace deps (`packages/backend`, `packages/frontend`, `packages/shared`, `packages/e2e`) and registers the `lefthook` pre-commit hook (ADR-0016). If it fails, show the full npm error — do not truncate.

## Step 3 — Environment file

Check whether `.env` exists at the repo root.

- If it does **not** exist, copy `.env.example` → `.env` and tell the user the defaults are suitable for local dev.
- If it **does** exist, skip this step silently.

## Step 4 — Green-bar gate

```bash
npm run check
```

This runs: lint → typecheck → layer check → unit + integration + component tests → bundle-size budget. All must pass.

If any step fails:
1. Print which sub-command failed and its output.
2. Do **not** attempt to auto-fix — report the failure and stop.

## Step 5 — Summary and next steps

Print a concise status table:

| Step | Status |
|---|---|
| Prerequisites | ✓ / ✗ |
| npm install | ✓ / ✗ |
| .env | ✓ created / ✓ already exists / ✗ |
| npm run check | ✓ / ✗ |

Then offer two paths:

**Option A — full Docker stack** (recommended for E2E or production-like testing):
```bash
docker compose up --build
# App: http://localhost:8081  API readiness: http://localhost:3000/readyz
```

> **Known build warning:** during `npm ci` inside the Alpine builder, you may see `Error: exec: "git": executable file not found in $PATH`. This comes from the root `prepare` script running `lefthook install` — git is absent in the container image. The `|| true` in the script makes it non-fatal; the build completes normally. Do not treat this as an error.

**Option B — dev servers** (recommended for active development):
```bash
npm run dev
# Backend: http://localhost:3000  Frontend: http://localhost:5173
```

Ask the user which they prefer and start it if they say yes.

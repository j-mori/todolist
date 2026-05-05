# ADR-0001: Monorepo via npm workspaces

**Status:** accepted
**Date:** 2026-05-04

## Context
The brief mandates a monorepo with separate FE and BE packages and asks us to avoid useless dependencies. Three packages are in scope (`backend`, `frontend`, `shared`), no fan-out to dozens. Pulling in a workspace orchestrator (Nx, Turborepo) for a 3-package repo would add tooling, config and a learning surface that pays back nothing at this scale.

## Decision
Use **npm workspaces** (built into npm 10/11, which ships with Node 24). Root `package.json` declares `"workspaces": ["packages/*"]`; cross-package imports resolve through workspace symlinks created automatically by `npm install`.

## Consequences
- **Positive:** Zero added deps. `npm install` from root provisions all packages. `--workspaces --if-present` propagates `lint`, `test`, `build`, `typecheck` across packages with no orchestrator config.
- **Trade-off:** No task graph, no remote cache, no incremental affected-only runs. For 3 packages this is irrelevant; if the workspace ever grows past ~10, revisit.
- **Follow-up:** None. Revisit only if build/test wall-time becomes a problem.

## Alternatives considered
- **pnpm workspaces** — rejected: faster + better hoisting, but adds a dep + an install step in Docker for marginal benefit at this scale.
- **Turborepo / Nx** — rejected: orchestrators justified by cross-package task graphs we don't have; would obscure how the toolchain actually runs.

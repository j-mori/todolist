# ADR-0012: Hexagonal folder layout per package

**Status:** accepted
**Date:** 2026-05-04

## Context
The brief asks for a hexagonal architecture: domain logic isolated from ports and adapters. Folder structure communicates and constrains; if the layering is invisible, it will rot. Both BE and FE benefit — the FE has its own domain model (the API contract reshaped for UI needs), application layer (query/mutation hooks), and adapters (HTTP client, eventually browser storage).

## Decision
Each `packages/<name>/src/` directory follows the same shape:

```
src/
  domain/         # pure: entities, value objects, errors. Zero deps.
  application/    # use cases (BE) or query/mutation hooks (FE). Defines ports. Imports domain only.
  adapters/       # concrete implementations of ports + driving adapters (HTTP, persistence, API client, UI).
  main.ts         # composition root: wires concrete adapters into ports.
  index.ts        # entrypoint (BE: starts server; FE: bootstraps React).
```

Layering rules (enforced by review and CLAUDE.md until lint enforcement lands):
- `domain/` imports nothing from `application/` or `adapters/`.
- `application/` imports `domain/` only.
- `adapters/` import `application/` ports + `domain/` types. Never the other way.
- `main.ts` is the only file allowed to wire concrete adapters into ports.

The `@todolist/shared` workspace holds *only* the API contract (Zod schemas + inferred TS types) — no business logic.

## Consequences
- **Positive:** Domain testable without I/O. Adapters swappable (in-memory ↔ SQLite, mock ↔ real HTTP) without touching domain. Composition root makes wiring explicit and reviewable in one file.
- **Trade-off:** More folders for a small codebase; the discipline is the point.

## Alternatives considered
- **Feature-folder layout** (`src/tasks/{model,service,api,ui}.ts`) — rejected: scales well by feature but obscures the ports/adapters split a hexagonal showcase needs to make obvious.
- **Flat `src/` with file-name conventions** — rejected: invisible layering; the brief explicitly asks us not to mix domain logic with ports and adapters.

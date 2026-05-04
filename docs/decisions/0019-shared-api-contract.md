# ADR-0019: API contract location — Zod schemas in `@todolist/shared`

**Status:** accepted
**Date:** 2026-05-04
**Session:** 03

## Context
Three places need the same understanding of the wire contract: the BE (validates incoming payloads, serialises responses), the FE (constructs requests, types responses, optionally validates), and developer tooling (OpenAPI export, future codegen). Three options:

1. **Hand-written TS types** in `@todolist/shared`, plus separate Zod schemas inside the BE. Two sources, drift inevitable.
2. **Zod schemas in `@todolist/shared`** with `z.infer` types exported alongside. One source of truth.
3. **OpenAPI spec as source of truth**, both BE and FE generate from it. Heavy machinery for a 7-route API.

ADR-0004 already pinned Zod as the validator. The only real question is whether the schemas live in BE-only or shared.

## Decision
**Option 2.** `@todolist/shared` exposes the contract: Zod schemas + inferred types, organised by concern.

```
packages/shared/src/
  contract/
    task.ts        # taskSchema, taskListSchema, taskStatusSchema, types
    requests.ts    # addTaskRequestSchema, updateTaskRequestSchema, taskIdParamSchema, types
    errors.ts      # validationErrorSchema, taskNotFoundErrorSchema, internalErrorSchema,
                   #   apiErrorSchema (discriminated union), errorResponseSchema, types
  index.ts         # re-exports everything
```

`zod` becomes a `dependencies` entry in `@todolist/shared/package.json`. The BE imports the schemas (runtime use); the FE imports the types (`type Task`, `type AddTaskRequest`, …) — Zod's tree-shakeable so unused schemas don't ship to the browser. The FE may opt into runtime validation for belt-and-braces correctness; we don't force it.

The BE re-validates inside the domain layer too (`TaskTitle.from`, etc.) — that's deliberate: Zod-at-the-edge guards the protocol; the domain VOs guard the invariant. Two layers, two responsibilities.

## Consequences
- **Positive:** Single source of truth — schema, type, validator. No drift between BE response shape and FE expectations. New endpoints are a Zod schema in one file plus a route handler that imports it. Adding OpenAPI export later (Session 7?) is a `@hono/zod-openapi` install, no schema rewrite.
- **Trade-off:** `@todolist/shared` is no longer dependency-free; it pulls Zod. Bundle impact on the FE is bounded by tree-shaking when only types are imported. Acceptable.
- **Follow-up:** Session 4 (FE) imports types only by default. If it wants client-side validation of responses (network-level paranoia), it imports the schemas. Session 7 may add `@hono/zod-openapi` to expose `/openapi.json`.

## Alternatives considered
- **Hand-written types** — rejected: drift is a matter of when, not if; the brief explicitly wants production-ready.
- **OpenAPI-first** — rejected: too much machinery for 7 endpoints; the Zod-as-source approach can produce OpenAPI later.
- **`@todolist/shared` exports types only, BE keeps schemas private** — rejected: forces redefinition of error/request shapes when the FE wants to validate them, which it might.

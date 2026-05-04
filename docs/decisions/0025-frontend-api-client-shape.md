# ADR-0025: FE API client — per-resource object, `Result`-typed, schema-validated responses

**Status:** accepted
**Date:** 2026-05-04
**Session:** 04

## Context
Session 4 introduces the typed FE client that talks to the BE described by `@todolist/shared`. Three axes were open:

- **Surface shape:** function-per-endpoint exports vs a single client object grouped by resource.
- **Response handling:** trust the server's JSON, or run it through the shared Zod schemas at the boundary.
- **Error reporting:** throw vs return a typed `Result<T, E>`.

The BE's domain layer already uses `Result<T, DomainError>` and tagged-union errors (ADR-0017). Mirroring that shape on the FE keeps the vocabulary uniform across the stack.

## Decision

**Per-resource object.** The FE exposes `tasksApi.list()`, `tasksApi.add(req)`, `tasksApi.complete(id)`, etc. Future resources get their own object. No stringly-typed routes at call sites.

**Responses validated via shared schemas.** Every successful response is parsed with the endpoint's schema (e.g. `taskListSchema` for `GET /tasks`); every failure response is parsed with `errorResponseSchema`. Schema mismatch becomes a synthetic `ContractViolation` `Result.err` rather than a malformed `data` value reaching React. The cost (zod runtime in the bundle) is already paid because we import schemas from `@todolist/shared` for response parsing — no incremental dependency.

**`Result<T, ApiClientError>` end-to-end at the adapter boundary.** Hooks unwrap the `Result`: on `Ok`, return the value; on `Err`, throw an `ApiClientErrorException` that wraps the typed error so TanStack Query records `error: ApiClientError` (typed via the hook's return type). Components read `query.error` as `ApiClientError`, never `unknown`.

```ts
// adapters/api/tasks-api.ts
export interface TasksApi {
  list(): Promise<Result<TaskList, ApiClientError>>;
  // Session 5 will add: add, updateTitle, complete, reopen, remove
}
```

```ts
// domain/api-error.ts — superset of @todolist/shared ApiError plus FE-only kinds
export type ApiClientError =
  | { kind: 'ValidationError'; field: string; reason: string; status: 400; requestId: string }
  | { kind: 'TaskNotFound';    id: string;                     status: 404; requestId: string }
  | { kind: 'InternalError';                                   status: number; requestId: string }
  | { kind: 'NetworkError';    cause: unknown;                 requestId: string }
  | { kind: 'ContractViolation'; details: string;              requestId: string };
```

`NetworkError` covers `fetch` rejections (DNS, CORS, offline). `ContractViolation` covers shape drift between FE and BE — visible runtime failure rather than a silent UI bug.

The HTTP wrapper (`http-client.ts`) is the only module that touches `fetch`. It generates an `X-Request-Id` per request via `crypto.randomUUID()`, attaches it as a header, surfaces it on every `ApiClientError`, and prefers the BE's echoed request id (header or body) when present.

## Consequences
- **Positive:** Single chokepoint for `fetch`, request-ids, and schema validation. Errors are typed at the call site without `as ApiError` casts. Schema drift fails loudly. The shape mirrors the BE's `Result`/tagged-union vocabulary, keeping cross-stack reasoning uniform.
- **Trade-off:** Two error worlds (`ApiClientError` for the adapter, `ApiError` for the wire). Justified — the adapter has concerns the wire contract doesn't (network failures, contract violations), and conflating them would push wire-only kinds onto the BE.
- **Follow-up:** When Session 5 adds mutations, each new endpoint extends `TasksApi` and gets its own success schema; the same `request<T>(req)` wrapper covers them.

## Alternatives considered
- **Function-per-endpoint exports (`listTasks()`, `addTask(req)`)** — rejected: harder to mock as a unit (the test wrapper wants one `tasksApi` to inject); pollutes the import graph.
- **Trust JSON; no schema parsing** — rejected: any BE drift becomes a UI bug, undetected until runtime users see broken state. Validation at boundaries is the project rule (CLAUDE.md, ADR-0019).
- **Throw on errors; let TanStack Query catch** — rejected: forces every consumer to type-assert `error as ApiClientError`; conflates programmer errors with expected error states; loses the intermediate testability point at the adapter boundary.

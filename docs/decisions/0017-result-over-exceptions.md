# ADR-0017: `Result<T, E>` and tagged-union errors over thrown exceptions

**Status:** accepted
**Date:** 2026-05-04
**Session:** 02

## Context
Domain code can fail in well-typed ways: validation, missing aggregates, business-rule violations. JavaScript's exceptions are untyped — `try { ... } catch (e: unknown)` — and silently bubble through layers, so error paths are easy to miss in code review and harder to map to HTTP responses without a global "find out what blew up" middleware.

CLAUDE.md already states the principle ("Errors as typed values at the domain layer; throw only for programmer errors"); this ADR pins the implementation.

## Decision
Two pieces:

1. **Result helpers** (`domain/shared/result.ts`):
   ```ts
   export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
   export const ok  = <T>(value: T): Result<T, never> => ({ ok: true, value });
   export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
   ```

2. **Tagged-union domain errors** (`domain/task/errors.ts`):
   ```ts
   export type ValidationError = { kind: 'ValidationError'; field: string; reason: string };
   export type TaskNotFound    = { kind: 'TaskNotFound';    id: string };
   export type DomainError     = ValidationError | TaskNotFound;
   ```

Every use case returns `Promise<Result<T, E>>` where `E` is a precise union of the failures it can produce. `throw` is reserved for programmer errors (assertion failures, illegal-state checks that should be unreachable).

## Consequences
- **Positive:**
  - Type system enforces handling. A caller of `addTask` cannot ignore `ValidationError` — it's in the return type.
  - Mapping to HTTP in Session 3 is a `switch` on `error.kind` (`ValidationError → 400`, `TaskNotFound → 404`). No global error middleware required.
  - No invisible control flow across layers. Adapters can throw if they want (DB connection lost) and the use case decides to catch and surface.
- **Trade-off:** More boilerplate in callers (`if (!r.ok) return err(r.error)`). The TS narrowing is good enough that we don't need a `Result.map` / `Result.andThen` helper library yet — if it becomes painful, we'll add a tiny one rather than depending on `neverthrow` or similar.
- **Follow-up:** Session 3's HTTP adapter centralises the `error.kind → status code` mapping in one place. Session 4's FE will mirror the discriminant for typed mutation error states.

## Alternatives considered
- **Throw typed `Error` subclasses** — rejected: `instanceof` checks across module boundaries are fragile (esp. with esbuild/Vite chunk splitting), and the type system doesn't track what a function can throw.
- **`neverthrow` / `effect-ts` / `fp-ts`** — rejected: extra dependency for a 6-line concept; the showcase value is in the discipline, not the library.
- **Mixed throw + return** — rejected: worst of both worlds; review can't tell which functions to guard.

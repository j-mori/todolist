# ADR-0024: Wire dates stay as ISO strings on the FE; `Intl` formats at the UI edge

**Status:** accepted
**Date:** 2026-05-04
**Session:** 04

## Context
The wire `Task` exposes `createdAt` and `updatedAt` as ISO 8601 strings (per `taskSchema` in `@todolist/shared`). The FE has three options for the in-memory shape:

1. **Strings throughout.** `task.createdAt` is a string; format with `Intl.DateTimeFormat` (or `new Date(s)` ad hoc) wherever it surfaces.
2. **Parse to `Date` at the API client boundary.** The FE's `Task` type diverges from the wire `Task` type — same name, different shape.
3. **Add `.transform(s => new Date(s))` to `taskSchema` in `@todolist/shared`.** The contract returns `Date` to all consumers (BE included).

## Decision
Adopt **(1)**. The FE's in-memory `Task` is identical to the wire `Task`: `createdAt` and `updatedAt` are strings. Formatting lives in `application/formatting/format-task-timestamp.ts`, an `Intl.DateTimeFormat`-based pure function.

## Consequences
- **Positive:** Wire type === in-memory type. No silent divergence between what TanStack Query caches, what tests assert, and what the network actually returned. No date-fns / dayjs / luxon dependency. `<time datetime={task.createdAt}>` is correct without any conversion. ISO strings sort lexicographically as they sort temporally for UTC, which is what the BE emits — useful for debugging.
- **Trade-off:** Any consumer that needs a `Date` instance (e.g. relative-time formatting, calendar widgets) writes `new Date(task.createdAt)` at the call site. For the small surface this app has, that cost is negligible.
- **Follow-up:** If a future session pulls in a date-pickering component or relative-time logic that benefits from a `Date` API, that consumer parses locally; we revisit only if the conversions outnumber the call sites.

## Alternatives considered
- **Parse at the API boundary (option 2)** — rejected: forks the FE's `Task` type from the contract; harder to reason about; breaks `taskListSchema.parse(json)` round-trip equivalence in tests.
- **Transform in `@todolist/shared` (option 3)** — rejected: forces `Date` on the BE too (where it's already an aggregate property as a string after serialisation); breaks `taskSchema.parse(json)` reflexivity (the parsed value would no longer match the input shape); makes JSON.stringify-then-parse non-trivial.

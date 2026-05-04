# ADR-0016: Determinism via ports — `Clock` and `IdGenerator`

**Status:** accepted
**Date:** 2026-05-04
**Session:** 02

## Context
Use cases need the current time and fresh IDs. The two obvious options — calling `Date.now()` and `crypto.randomUUID()` directly — couple the domain to ambient state and force tests to either mock globals (`vi.useFakeTimers`-style) or assert on opaque, non-deterministic values. Both undermine the "tests assert behaviour, not implementation" goal.

Independently, the Session 1 handoff pinned a stricter rule for the domain layer: "Domain code may not import from `node:` packages other than `node:test` (and that only in `*.test.ts`)." `crypto.randomUUID()` is technically available as a global, but `Date` is also ambient — neither can be controlled from a test without monkey-patching.

## Decision
Two additional ports, alongside `TaskRepository`:

```ts
// application/ports/clock.ts
export type Clock = { now(): Date };

// application/ports/id-generator.ts
export type IdGenerator = { next(): TaskId };
```

The composition root (Session 3's `main.ts`) wires concrete implementations: `{ now: () => new Date() }` and `{ next: () => TaskId.unsafe(crypto.randomUUID()) }`. Tests use `FixedClock` and `SequentialIdGenerator` from `application/test-support/`.

## Consequences
- **Positive:** Use-case tests are fully deterministic — assertions on `updatedAt` and `id` use literal values, not "any string" or "≥ now()". Time-dependent behaviour (`Task.complete` advancing `updatedAt`) is testable without globally faking `Date`. The same pattern keeps the door open for Session 6 (E2E) to seed predictable IDs in test fixtures.
- **Trade-off:** Two extra port types and two extra constructor args on every time- or id-using use case. Acceptable: explicit dependencies are the point of hexagonal.
- **Follow-up:** Session 3 must wire real adapters in `main.ts` and decide whether to unify them under a single `SystemContext` object or keep them as discrete deps. Default: discrete, until repetition warrants grouping.

## Alternatives considered
- **Read `Date.now()` / `crypto.randomUUID()` directly** — rejected: tests become flaky or need global monkey-patching.
- **Pass `Date` and `string` straight in to use cases** — rejected: shifts the responsibility to every caller (HTTP layer, CLI, scheduled job) and forgets nothing in code review.
- **Vitest fake timers / `node:test` mock.timers** — rejected: works for `Date.now()` but not for UUID generation, and trains us to mock instead of inject.

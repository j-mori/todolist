# ADR-0008: TanStack Query v5 for server state

**Status:** accepted
**Date:** 2026-05-04
**Session:** 01

## Context
Session 5 will deliver optimistic updates with rollback on error, retries, cache invalidation on mutation. Hand-rolling that on top of `fetch` + `useState` is a known anti-pattern at any non-trivial scale. Candidates: **TanStack Query v5** (de-facto), **SWR** (lighter, less feature-rich), **React 19 `use()` + manual cache** (rolling our own — not the kind of thing a 2026 reference repo should ship), **RTK Query** (drags Redux in).

## Decision
Use **TanStack Query v5** as the only server-state library on the FE. Query and mutation hooks live under `packages/frontend/src/application/`; the typed fetch client lives under `src/adapters/api/` and is the only module that touches `fetch`.

## Consequences
- **Positive:** Optimistic mutations, retry, cache invalidation, devtools, suspense interop — all out of the box. No client-state library needed; component state covers the rest.
- **Trade-off:** ~14kB gzip. Justified by what it replaces.
- **Follow-up:** Session 5 enforces that components never call `fetch` directly; only hooks from `application/` may.

## Alternatives considered
- **SWR** — rejected: fewer features around mutations and cache invalidation patterns we'll need.
- **React 19 `use()` only** — rejected: would require us to roll cache, retry and optimistic update logic by hand, undermining "no useless reinvention".
- **RTK Query** — rejected: Redux baggage we don't need.

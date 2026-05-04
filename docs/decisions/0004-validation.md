# ADR-0004: Zod for runtime validation

**Status:** accepted
**Date:** 2026-05-04
**Session:** 01

## Context
We need runtime validation in two places: (1) at the HTTP boundary (request bodies, query params), and (2) inside the domain to construct value objects (`TaskTitle`, `TaskId`). Picking the same library for both keeps the mental model small. Candidates: **Zod v4** (de-facto, large ecosystem), **Valibot** (smaller bundle, similar API), **ArkType** (faster, less stable), **TypeBox** (JSON-Schema-first, awkward DX).

## Decision
Use **Zod v4** for all runtime validation. Domain value objects are constructed via `TaskTitle.parse(input)` returning a branded type; HTTP handlers validate request payloads with the same schemas. The contract is shared across BE and (in Session 4) FE via the `@todolist/shared` workspace.

## Consequences
- **Positive:** Single mental model for validation. Inferred TS types from schemas — no drift. Zod v4 is faster than v3 and trims its bundle. Ecosystem (Hono adapters, OpenAPI generators) speaks Zod natively.
- **Trade-off:** Bundle size on the FE if shared schemas are imported wholesale. Mitigation: keep `@todolist/shared` schemas tree-shakeable.
- **Follow-up:** Session 2 introduces value-object schemas; Session 3 wires Zod into Hono routes.

## Alternatives considered
- **Valibot** — rejected: smaller but ecosystem (Hono OpenAPI, etc.) lags.
- **ArkType** — rejected: API not yet stable enough for a "production-ready" reference.
- **TypeBox** — rejected: JSON-Schema-first feels right for OpenAPI export but worse DX for domain value objects.

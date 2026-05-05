# ADR-0002: Hono as the backend framework

**Status:** accepted
**Date:** 2026-05-04

## Context
The backend exposes a small REST surface (CRUD on tasks). We considered (a) **vanilla `node:http`**, (b) **Hono** — a fetch-API-based, ~14kB, TS-first framework, and (c) **Fastify** — mature, schema-first. Vanilla `node:http` shifts routing/middleware/JSON handling into our code, which adds boilerplate and noise without teaching anything new in a hexagonal showcase. Fastify's JSON-Schema-first ergonomics fight Zod (our chosen validator). Hono's `Request`/`Response` model maps cleanly onto adapters and is testable in-process via `app.request()`.

## Decision
Use **Hono** for the HTTP adapter, served by **`@hono/node-server`** on Node 24. The adapter exposes a `createApp()` factory; the composition root in `src/main.ts` wires it. Tests fire requests via `app.request()` without spinning up a real port.

## Consequences
- **Positive:** Tiny dep surface (~2 packages). Web-standard primitives port to other runtimes. In-process integration tests are trivial. Type-safe middleware chain.
- **Trade-off:** Two deps where the brief leans toward zero (`hono` + `@hono/node-server`). Justified by the boilerplate avoided.

## Alternatives considered
- **Vanilla `node:http`** — rejected: forces hand-rolled routing, content-type negotiation, error wrapping. Pure for purity's sake.
- **Fastify** — rejected: schema-first via JSON Schema is awkward when Zod is already chosen for value-object validation in the domain.
- **Express** — rejected: legacy callback patterns, still painful with TS, no upside.

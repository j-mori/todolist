# ADR-0005: Pino for structured logging

**Status:** accepted
**Date:** 2026-05-04
**Session:** 01

## Context
The container ships logs to stdout. Anything observability-grade (Datadog, GCP, ELK) ingests JSON happily and parses unstructured text poorly. `console.log` produces plain strings; for a "production-ready" reference, structured JSON with levels, timestamps and contextual fields is the bar.

## Decision
Use **Pino** for all backend logs. Single instance created in `src/index.ts`, optionally child-loggers per module. JSON output to stdout in production; pino-pretty is *not* installed (dev-time pretty-printing belongs in the `dev` workflow, not in production deps).

## Consequences
- **Positive:** Fastest Node logger by a wide margin. Native JSON. Plays nicely with Docker, GCP Logging, Datadog. Tree-shakeable and dependency-light.
- **Trade-off:** Raw JSON in dev terminals is noisy. Acceptable; can pipe through `npx pino-pretty` ad-hoc when reading logs interactively.
- **Follow-up:** Session 7 may add request-scoped logging via Hono middleware (request id, latency).

## Alternatives considered
- **Winston** — rejected: slower, transports model is more ceremony than value here.
- **Native `console`** — rejected: no levels, no structure, no timestamps — fails the production-ready bar.
- **Built-in `node:util.styleText`** — useful for the dev experience but not a logger.

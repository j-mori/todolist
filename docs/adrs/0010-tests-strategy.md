# ADR-0010: Three-layer test strategy — node:test, Vitest, Playwright

**Status:** accepted
**Date:** 2026-05-04

## Context
The brief calls for the repo to be the "bible of testing" — multiple layers, every test earning its keep, no test that survives the deletion of the behaviour it claims to cover. We need different runners for different environments: backend tests run in Node (no DOM), component tests need a DOM-like environment, end-to-end tests need a browser and a running stack.

## Decision
Three test runners, one per layer:

1. **Backend** — `node:test` (built-in) for unit (pure domain) and integration (HTTP + persistence). Run with `node --test --experimental-strip-types 'src/**/*.test.ts'`. No mocks at port boundaries; integration tests run against real adapters (in-memory SQLite, in-process Hono).
2. **Frontend (component)** — **Vitest** with `happy-dom` and `@testing-library/react`. Runs in the same process as the FE source, reusing Vite's transform pipeline.
3. **End-to-end** — **Playwright** running specs against the docker-composed stack with seeded data.

Layering rule: if a test passes when its production code is deleted, the test is wrong. If a test mocks an adapter at the port boundary, it is the wrong layer.

## Consequences
- **Positive:** Right tool per layer, no compromises. `node:test` keeps backend dep-free. Vitest's Vite alignment means component tests run with the same module resolution as the app. Playwright provides traces and screenshots for E2E debugging.
- **Trade-off:** Two test commands (`node --test` for BE, `vitest run` for FE). Acceptable — fewer commands than the diversity warrants.

## Alternatives considered
- **Vitest everywhere** — rejected: drags Vitest into the BE which contradicts "prefer Node built-ins" for a runner where `node:test` is genuinely sufficient.
- **`node:test` everywhere** — rejected: usable for component tests but ergonomics for `@testing-library/react` + happy-dom are far better in Vitest.
- **Jest** — rejected: legacy, slow, awkward TS+ESM story.
- **Playwright Component Testing** — rejected: still maturing; Vitest + Testing Library is the safer 2026 choice for component layer.

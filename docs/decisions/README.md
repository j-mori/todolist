# Architecture Decision Records

ADRs capture the *why* behind every non-trivial choice. Each entry below links to a record using the 5-section format (Status / Context / Decision / Consequences / Alternatives) defined in [`_template.md`](../../../obsidian/claude/todolist/decisions/_template-adr.md). Future sessions cite the ADR id; they do not re-litigate the rationale.

| # | Title | Status |
|---|---|---|
| 0001 | [Monorepo tool — npm workspaces](./0001-monorepo-tool.md) | accepted |
| 0002 | [Node 24 LTS as the runtime](./0002-node-version.md) | accepted |
| 0003 | [Hono as the backend framework](./0003-backend-framework.md) | accepted |
| 0004 | [Zod for runtime validation](./0004-validation.md) | accepted |
| 0005 | [Pino for structured logging](./0005-logging.md) | accepted |
| 0006 | [`node:sqlite` + Kysely for storage](./0006-storage.md) | accepted |
| 0007 | [Vite + React 19 for the frontend](./0007-frontend-build-tool.md) | accepted |
| 0008 | [TanStack Query for server state](./0008-frontend-data-fetching.md) | accepted |
| 0009 | [Tailwind v4 for styling](./0009-styling.md) | accepted |
| 0010 | [Biome for lint and format](./0010-lint-format.md) | accepted |
| 0011 | [Test strategy: node:test + Vitest + Playwright](./0011-test-strategy.md) | accepted |
| 0012 | [Per-package multi-stage Docker + compose](./0012-container-strategy.md) | accepted |
| 0013 | [Hexagonal folder layout per package](./0013-hexagonal-layout.md) | accepted |
| 0014 | [`Task` aggregate shape and invariants](./0014-task-aggregate-shape.md) | accepted |
| 0015 | [Title normalisation — trim before validate, cap at 200 chars](./0015-title-normalisation.md) | accepted |
| 0016 | [Determinism via ports — `Clock` and `IdGenerator`](./0016-determinism-via-ports.md) | accepted |
| 0017 | [`Result<T, E>` and tagged-union errors over thrown exceptions](./0017-result-over-exceptions.md) | accepted |
| 0018 | [REST design — action endpoints, status codes, idempotent semantics](./0018-rest-design.md) | accepted |
| 0019 | [API contract location — Zod schemas in `@todolist/shared`](./0019-shared-api-contract.md) | accepted |
| 0020 | [Error response envelope `{ error: { kind, ... } }`](./0020-error-response-envelope.md) | accepted |
| 0021 | [Schema initialised idempotently on boot — no migration runner (yet)](./0021-schema-init-on-boot.md) | accepted |
| 0022 | [Production hardening — explicit configuration, required deps, security middleware](./0022-production-hardening.md) | accepted (addendum 2026-05-05) |
| 0023 | [FE → BE traffic via same-origin `/api` proxy in dev (Vite) and prod (nginx)](./0023-frontend-dev-proxy-and-prod-nginx-proxy.md) | accepted |
| 0024 | [Wire dates stay as ISO strings on the FE; `Intl` formats at the UI edge](./0024-frontend-wire-dates-as-strings.md) | accepted |
| 0025 | [FE API client — per-resource object, `Result`-typed, schema-validated responses](./0025-frontend-api-client-shape.md) | accepted |
| 0027 | [FE mutation pattern — TanStack Query optimistic updates, `Error`-subclass throws, typed `mutation.error`](./0027-frontend-mutation-pattern.md) | accepted |
| 0028 | [FE notifications — in-house provider, polite live region, errors persist with `requestId`](./0028-frontend-notifications.md) | accepted |
| 0029 | [Frontend production-readiness cleanup — strict typing, env-driven config, request cancellation, security headers, bundle budgets](./0029-frontend-production-readiness-cleanup.md) | accepted |
| 0030 | [E2E conventions — Playwright + docker compose, role-based selectors, API-driven isolation](./0030-e2e-conventions.md) | accepted |
| 0031 | [GitLab CI as the pipeline platform](./0031-gitlab-ci.md) | accepted |
| 0032 | [`dependency-cruiser` enforces the hex-layer import rules](./0032-dependency-cruiser-hex-enforcement.md) | accepted |
| 0033 | [`lefthook` for pre-commit hooks (biome on staged files)](./0033-lefthook-pre-commit.md) | accepted |

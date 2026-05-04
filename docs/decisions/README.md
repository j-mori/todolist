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

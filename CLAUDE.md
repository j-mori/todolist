# Todolist

State-of-the-art TypeScript 2026 reference app: production-ready, hexagonal, multi-layer tested, fully containerised.

> Build is split across 7 sessions tracked at `/Users/jacopo.mori/Sites/obsidian/claude/todolist/00-master-plan.md`. **Always read the latest handoff in `/Users/jacopo.mori/Sites/obsidian/claude/todolist/handoffs/` before changing code.**

## Stack

| Area | Choice | ADR |
|---|---|---|
| Runtime | Node 24 LTS (Alpine in containers) | [0002](docs/decisions/0002-node-version.md) |
| Monorepo | npm workspaces | [0001](docs/decisions/0001-monorepo-tool.md) |
| BE framework | Hono on `@hono/node-server` | [0003](docs/decisions/0003-backend-framework.md) |
| Validation | Zod v4 (BE + shared contract) | [0004](docs/decisions/0004-validation.md) |
| Logging | Pino (structured JSON) | [0005](docs/decisions/0005-logging.md) |
| Storage | `node:sqlite` + Kysely | [0006](docs/decisions/0006-storage.md) |
| FE build | Vite + React 19 | [0007](docs/decisions/0007-frontend-build-tool.md) |
| FE data | TanStack Query v5 | [0008](docs/decisions/0008-frontend-data-fetching.md) |
| Styling | Tailwind v4 (`@tailwindcss/vite`) | [0009](docs/decisions/0009-styling.md) |
| Lint/format | Biome v2 | [0010](docs/decisions/0010-lint-format.md) |
| Tests | `node:test` (BE), Vitest (FE), Playwright (E2E) | [0011](docs/decisions/0011-test-strategy.md) |
| Containers | Per-package multi-stage Docker + compose | [0012](docs/decisions/0012-container-strategy.md) |
| Layout | Hexagonal per package | [0013](docs/decisions/0013-hexagonal-layout.md) |

## Layout

```
packages/
  shared/        # API contract (Zod schemas + inferred types). No business logic.
  backend/
    src/
      domain/         # pure: entities, value objects, errors
      application/    # use cases + ports
      adapters/
        http/         # Hono routes
        persistence/  # node:sqlite + Kysely
      main.ts         # composition root
      index.ts        # server entrypoint
  frontend/
    src/
      domain/         # pure types mirroring API contract
      application/    # query/mutation hooks (TanStack Query)
      adapters/
        api/          # typed fetch client
      ui/             # React components
      main.tsx        # bootstraps React
docs/
  decisions/   # ADRs (see docs/decisions/README.md)
  sessions/    # per-session plans, kept after approval
```

## Commands

| Script | What it does |
|---|---|
| `npm install` | Install all workspace deps |
| `npm run dev` | Run BE + FE dev servers in parallel |
| `npm run build` | tsc + vite build per workspace |
| `npm run test` | `node:test` (BE) + Vitest (FE) |
| `npm run test:e2e` | Playwright (real suite arrives in Session 6) |
| `npm run lint` | `biome lint .` |
| `npm run format` | `biome format --write .` |
| `npm run typecheck` | `tsc --noEmit` per workspace |
| `npm run check` | lint + typecheck + test (the green-bar gate) |
| `docker compose up --build` | Boot the full stack |

Stack ports: BE on `:3000`, FE on `:8081`. (8080 is taken by Docker Desktop on the dev machine.)

## Layering rules (hexagonal)

- `domain/` imports nothing from `application/` or `adapters/`.
- `application/` imports `domain/` only. Defines ports (interfaces).
- `adapters/` import `application/` ports + `domain/` types. Never the other way.
- `main.ts` is the *only* file allowed to wire concrete adapters into ports.

Lint enforcement of these boundaries is a **known gap** — Biome v2 has no first-class `no-restricted-imports`-across-folders rule. Revisit in Session 7 (Biome plugin or `dependency-cruiser` companion). Until then: review discipline.

## Testing

Each test must justify its existence by failing if a real behaviour breaks.

- **Unit** (`node:test`, BE): pure domain + use cases. No I/O. No port mocks at the application boundary except where simulating adapter behaviour the unit must react to.
- **Integration** (`node:test`, BE): HTTP + persistence against real adapters (in-memory SQLite, in-process Hono). No port-level mocks.
- **Component** (Vitest + Testing Library + happy-dom, FE): renders components with realistic props/contexts; asserts what the user perceives.
- **E2E** (Playwright): user journeys against the docker-composed stack with seeded data.

If a test passes after deleting its target behaviour, the test is wrong. If a test mocks an adapter at the port boundary, it is the wrong layer.

## Conventions

- **No `any`.** No `// @ts-expect-error` without an ADR or an issue-link comment.
- **Comments only when explaining a non-obvious *why*.** Code that needs comments to explain *what* should be rewritten.
- **Prefer Node built-ins** (`node:test`, `node:sqlite`, `node --run`, `--experimental-strip-types`) over deps.
- **Errors as typed values** at the domain layer (e.g. `Result<T, DomainError>`); throw only for programmer errors.
- **Validate at boundaries, trust internally.** Zod parses request payloads and constructs value objects; once inside the domain, types are guaranteed.
- **Two-space indent, single quotes, trailing commas, 100-char line.** Enforced by Biome.
- **Imports use `.ts` extensions** (Node 24 strip mode + `rewriteRelativeImportExtensions`).

## Pointers

- Master plan: `/Users/jacopo.mori/Sites/obsidian/claude/todolist/00-master-plan.md`
- Session roadmap: `/Users/jacopo.mori/Sites/obsidian/claude/todolist/01-session-roadmap.md`
- Latest handoff: `/Users/jacopo.mori/Sites/obsidian/claude/todolist/handoffs/`
- ADR index: [`docs/decisions/README.md`](docs/decisions/README.md)
- Session plans (kept after approval): [`docs/sessions/`](docs/sessions/)

## Token tips for future Claude sessions

- Read this file + the latest handoff first; **don't grep blindly**.
- Use the **Explore** subagent for any reconnaissance beyond two reads — keeps the main context lean.
- Touch only the layer your session owns. The session roadmap pins responsibilities.
- Decisions go in ADRs, not in this file. This file stays an index.

# Todolist

A small task manager built as a 2026 TypeScript reference: production-ready, hexagonal, multi-layer tested, fully containerised.

|  |  |
|---|---|
| **Stack** | Node 24 · Hono · `node:sqlite` + Kysely · React 19 · Vite · Tailwind v4 · TanStack Query v5 · Zod |
| **Layout** | npm workspaces — `backend`, `frontend`, `shared`, `e2e` |
| **Tests** | 115 across 4 layers — `node:test`, Vitest, Playwright |

## Quickstart

```bash
git clone <this repo> && cd todolist
docker compose up --build
```

Open <http://localhost:8081>. API readiness: <http://localhost:3000/readyz>.

> **Using Claude Code?** Run `/todolist:setup` instead — it checks prereqs, installs, sets up `.env`, runs the green-bar gate, and starts the dev server for you.

## Local development

```bash
npm install            # Node 24+, npm 11+; installs the lefthook pre-commit hook
npm run dev            # backend :3000 + Vite :5173
npm run check          # lint + typecheck + layers + tests + bundle budget
```

Full script reference: [`docs/scripts.md`](docs/scripts.md).

## Documentation

| Doc | What you'll find |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | Workspaces, request flow, hex layers, REST surface, operational concerns, containers |
| [`docs/scripts.md`](docs/scripts.md) | Every npm script — what it does, when to run it, what it costs |
| [`docs/conventions.md`](docs/conventions.md) | Types, errors, layering, code style, testing discipline, git |
| [`docs/testing.md`](docs/testing.md) | Per-layer scope: what unit, integration, component, and E2E tests do — and don't do |
| [`docs/adrs/`](docs/adrs/) | Architecture Decision Records — every choice with context, consequences, and rejected alternatives |
| [`CLAUDE.md`](CLAUDE.md) | Token-efficient pointers for AI coding assistants working in this repo |

## License

UNLICENSED — personal showcase, not for redistribution.

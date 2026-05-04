# Session 1 — Architecture & Foundations

## Context

This is the kickoff of a 7-session build of a To-Do List app intended as a **showcase reference for state-of-the-art TypeScript in 2026** — production-ready, hexagonal, fully containerised, with multi-layer testing as a centrepiece. The brief, technical preferences, and master plan are in `/Users/jacopo.mori/Sites/obsidian/claude/todolist/`.

Session 1 owns the foundations only: scaffold the monorepo, lock in the toolchain via ADRs, and ship an empty-but-runnable repo. **Zero domain code, zero UI, zero storage schema, zero API endpoints.** Sessions 2–7 fill those in.

The dependency list, kysely vs raw SQL, Tailwind v4, Node 24 LTS, and the no-ticket branch convention have all been **pre-approved by the user** in conversation prior to plan mode. This plan implements those decisions; it does not re-litigate them.

## Repo location & branch

- **Path:** `/Users/jacopo.mori/Sites/todolist` (does not yet exist; Session 1 creates it)
- **Git:** `git init`, branch `jacopo.mori/scaffold`, single initial commit at end
- **Commits:** Conventional Commits (`chore: scaffold monorepo`) — personal showcase repo, not Mollie work

## Stack (locked, ADR each)

| # | Area | Choice | ADR |
|---|---|---|---|
| 1 | Monorepo | npm workspaces (built into npm 10) | ADR-0001 |
| 2 | Runtime | Node 24 LTS (Alpine in containers) | ADR-0002 |
| 3 | BE framework | Hono (Fetch-API based) | ADR-0003 |
| 4 | Validation | Zod v4 (boundary + value-object guard) | ADR-0004 |
| 5 | Logging | Pino (structured JSON) | ADR-0005 |
| 6 | Storage | `node:sqlite` (built-in) + Kysely (typed query builder) | ADR-0006 |
| 7 | FE build | Vite (latest stable) + React 19 | ADR-0007 |
| 8 | FE data | TanStack Query v5 | ADR-0008 |
| 9 | Styling | Tailwind v4 via `@tailwindcss/vite` | ADR-0009 |
| 10 | Lint/format | Biome (single binary, replaces ESLint+Prettier) | ADR-0010 |
| 11 | Tests | `node:test` (BE unit/integration), Vitest + @testing-library + happy-dom (FE component), Playwright (E2E) | ADR-0011 |
| 12 | Containers | Per-package multi-stage Dockerfile + root docker-compose.yml | ADR-0012 |
| 13 | Layout | Hexagonal: `domain/`, `application/`, `adapters/`, `main.ts` per package | ADR-0013 |

Versions: install latest stable as of 2026-05-04 (recorded in `package-lock.json`).

## Folder layout

```
todolist/
├── .dockerignore
├── .editorconfig
├── .gitignore
├── biome.json
├── docker-compose.yml
├── package.json                    # workspaces: packages/*
├── tsconfig.base.json
├── README.md
├── CLAUDE.md                       # ≤200 lines; index, not knowledge base
├── docs/
│   ├── decisions/
│   │   ├── README.md               # ADR index
│   │   ├── 0001-monorepo-tool.md
│   │   ├── 0002-node-version.md
│   │   ├── 0003-backend-framework.md
│   │   ├── 0004-validation.md
│   │   ├── 0005-logging.md
│   │   ├── 0006-storage.md
│   │   ├── 0007-frontend-build-tool.md
│   │   ├── 0008-frontend-data-fetching.md
│   │   ├── 0009-styling.md
│   │   ├── 0010-lint-format.md
│   │   ├── 0011-test-strategy.md
│   │   ├── 0012-container-strategy.md
│   │   └── 0013-hexagonal-layout.md
│   └── sessions/
│       └── 01-plan.md              # this file, copied verbatim
└── packages/
    ├── shared/                     # API contract types, shared between BE+FE (filled in Session 3)
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/index.ts            # placeholder export
    ├── backend/
    │   ├── Dockerfile              # multi-stage: builder → node:24-alpine runtime
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── domain/             # pure: entities, value objects, errors. Zero deps.
    │       ├── application/        # use cases + ports (interfaces). Imports domain only.
    │       ├── adapters/
    │       │   ├── http/           # Hono routes. Imports application + domain.
    │       │   └── persistence/    # node:sqlite + Kysely repos. Imports application + domain.
    │       ├── main.ts             # composition root: wires concrete adapters into ports
    │       └── index.ts            # entrypoint: starts HTTP server, calls main()
    └── frontend/
        ├── Dockerfile              # multi-stage: builder → nginx:alpine static server
        ├── nginx.conf              # SPA fallback to index.html
        ├── package.json
        ├── tsconfig.json
        ├── vite.config.ts
        ├── index.html
        └── src/
            ├── domain/             # pure types mirroring API contract
            ├── application/        # query/mutation hooks, optimistic updaters
            ├── adapters/
            │   └── api/            # typed fetch client (consumes @todolist/shared)
            ├── ui/                 # React components
            ├── styles.css          # Tailwind directives
            └── main.tsx            # entrypoint
```

## Hexagonal layering rules (enforced by convention; documented in CLAUDE.md)

- `domain/` imports nothing from `application/` or `adapters/`.
- `application/` imports `domain/` only. Defines ports (interfaces).
- `adapters/` import `application/` ports + `domain/` types. Never the other way.
- `main.ts` is the only file allowed to wire concrete adapters into ports.

(Lint enforcement of these boundaries is a Session 2/7 follow-up — Biome doesn't have an out-of-the-box "no-restricted-imports across folders" rule the way ESLint does. Documented as a known gap.)

## Stub services (must boot under `docker compose up`)

**Backend** — minimal Hono app:
- `GET /health` → `{ "status": "ok" }`
- Listens on port 3000
- Started via `node --run start` from compiled `dist/index.js`

**Frontend** — minimal Vite + React 19 + Tailwind v4 app:
- `index.html` + `App` component rendering "To-Do List" headline with Tailwind classes
- Dev: Vite on 5173
- Prod: built static assets served by `nginx:alpine` on port 80, exposed as 8080 in compose

**Smoke tests (one per package, justify their existence by guarding the wiring):**
- `packages/backend/src/index.test.ts` — `node:test`: fires `app.request('/health')` in-process, asserts 200 + body shape. Guards: route registered, JSON serialisation works.
- `packages/frontend/src/App.test.tsx` — Vitest: renders `<App />`, asserts headline text present. Guards: React + Tailwind build pipeline produces a working bundle.

## Root npm scripts (`node --run` style)

| Script | What it does |
|---|---|
| `dev` | Runs backend + frontend dev servers in parallel (using `--workspaces` + `&`, no `concurrently` dep) |
| `build` | `npm --workspaces run build` — tsc per package, vite build for FE |
| `test` | `npm --workspaces run test` — node:test BE, vitest FE |
| `test:e2e` | Placeholder; real suite in Session 6 |
| `lint` | `biome lint .` |
| `format` | `biome format --write .` |
| `typecheck` | `npm --workspaces run typecheck` (`tsc --noEmit` per package) |
| `check` | `npm run lint && npm run typecheck && npm run test` — the green-bar gate |

All scripts must exit 0 on the empty scaffold.

## TypeScript config

`tsconfig.base.json`:
- `target: ES2024`, `module: NodeNext`, `moduleResolution: NodeNext`
- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`
- `isolatedModules: true`, `verbatimModuleSyntax: true`
- `skipLibCheck: true` (pragmatic — keeps tsc fast)
- No `paths` aliasing in v1 (workspace package names handle cross-package imports)

Per-package `tsconfig.json` extends base, sets `outDir`, `rootDir`, `include`.

## Biome config

`biome.json`:
- Formatter: 2-space indent, single quotes for JS, trailing commas, line width 100
- Linter: `recommended` + `correctness` + `suspicious` + `style` + `nursery` (selectively)
- Import organisation: enabled
- Ignore: `dist/`, `node_modules/`, `playwright-report/`, `coverage/`

## Docker strategy

**`packages/backend/Dockerfile`** (multi-stage):
- Stage 1 `builder`: `node:24-alpine`; copy `package*.json`, `npm ci --include=dev`, copy src, `npm run build` → `dist/`
- Stage 2 `runtime`: `node:24-alpine`; copy `dist/` + production `node_modules`; `USER node`; `HEALTHCHECK` against `/health`; `EXPOSE 3000`; `CMD ["node", "dist/index.js"]`

**`packages/frontend/Dockerfile`** (multi-stage):
- Stage 1 `builder`: `node:24-alpine`; install + `npm run build` → `dist/`
- Stage 2 `runtime`: `nginx:alpine`; copy `dist/` to `/usr/share/nginx/html`; copy `nginx.conf`; `EXPOSE 80`

**`docker-compose.yml`**:
- `backend` service: build context `packages/backend`, port `3000:3000`, healthcheck on `/health`
- `frontend` service: build context `packages/frontend`, port `8080:80`, `depends_on: backend (healthy)`
- Single shared network. No volumes (storage comes in Session 3).

## ADR format

Use the 5-section template at `/Users/jacopo.mori/Sites/obsidian/claude/todolist/decisions/_template-adr.md` — Status / Context (one paragraph) / Decision (1–2 sentences) / Consequences (positive, trade-off, follow-up) / Alternatives considered (one line each, why rejected). All 13 ADRs land in this session at `accepted` status, dated 2026-05-04.

## CLAUDE.md

≤200 lines, structured per the template at `/Users/jacopo.mori/Sites/obsidian/claude/todolist/02-claude-md-template.md`. Sections:
- Project purpose (1 sentence)
- Stack table (link to each ADR)
- Layout (file tree, ≤20 lines)
- Commands (script names only)
- Layering rules (3–5 lines)
- Testing rules (5 lines)
- Conventions (5–10 lines: minimal comments, no `any`, prefer Node built-ins, Zod at boundaries)
- Pointers to obsidian master plan, ADR index, handoffs dir
- Token tips for future sessions (read handoff first; use Explore for >2 reads; touch only owned layer)

## Implementation order

1. `mkdir /Users/jacopo.mori/Sites/todolist && cd $_ && git init -b jacopo.mori/scaffold`
2. Root tooling files: `.gitignore`, `.dockerignore`, `.editorconfig`, `biome.json`, `tsconfig.base.json`, root `package.json` with workspaces
3. `packages/shared` scaffold (placeholder export)
4. `packages/backend` scaffold: package.json (Hono, Zod, Pino, Kysely as deps; TS, @types/node as dev), tsconfig, hexagonal `src/` skeleton, Hono health endpoint, smoke test, Dockerfile
5. `packages/frontend` scaffold: package.json (React 19, react-dom, @tanstack/react-query, tailwindcss, @tailwindcss/vite as deps; Vite, Vitest, @testing-library/react + jest-dom, happy-dom, TS as dev), tsconfig, vite.config.ts, hexagonal `src/` skeleton, App.tsx, smoke test, Dockerfile, nginx.conf
6. `docker-compose.yml`
7. All 13 ADRs in `docs/decisions/` + ADR index README
8. `CLAUDE.md`
9. `docs/sessions/01-plan.md` (copy of this plan)
10. `README.md` (30-second quickstart, link to CLAUDE.md and master plan)
11. `npm install` from root → produces `package-lock.json`
12. Run verification (below)
13. `git add -A && git commit -m "chore: scaffold monorepo with hexagonal TS toolchain"`
14. Write handoff: `/Users/jacopo.mori/Sites/obsidian/claude/todolist/handoffs/01-handoff.md`

## Verification (Definition of Done)

From the repo root:

```bash
npm install                                    # exits 0
npm run check                                  # lint + typecheck + smoke tests, exits 0
npm run build                                  # tsc + vite build, both succeed
docker compose build                           # both images build clean
docker compose up -d                           # both containers reach healthy
curl -fsS http://localhost:3000/health         # → {"status":"ok"}
curl -fsS http://localhost:8080/ | grep -q "To-Do"  # FE HTML served
docker compose down
git status                                     # clean working tree, single commit on jacopo.mori/scaffold
```

If any step above fails the session is **not done** — fix before writing the handoff.

## Out of scope (explicit; do NOT do)

- Domain code (`Task` aggregate, value objects) — Session 2
- Real persistence schema or migrations — Session 3
- API endpoints beyond `/health` — Session 3
- UI components beyond hello-world — Session 4–5
- Real test cases beyond per-package smoke — Sessions 2+
- CI config (GitHub Actions / GitLab CI) — Session 7 (CI *thinking* documented in README, not implemented)
- Observability stack beyond Pino logger setup
- Lint enforcement of hexagonal import boundaries (documented gap; revisit Session 7)

## Handoff plan

End the session by writing `/Users/jacopo.mori/Sites/obsidian/claude/todolist/handoffs/01-handoff.md` per the template at `handoffs/_template.md`. Must include:
- File tree summary of what was created
- All 13 ADR ids + one-line decision summaries
- The exact commands Session 2 needs to start (`cd /Users/jacopo.mori/Sites/todolist && git checkout -b jacopo.mori/domain && npm run check` etc.)
- Open questions: lint enforcement of layering, whether to add `packages/shared` content in Session 2 vs Session 3
- Pointer to next prompt: `/Users/jacopo.mori/Sites/obsidian/claude/todolist/prompts/02-backend-domain.md`

## Critical files this session creates

All paths relative to `/Users/jacopo.mori/Sites/todolist/`:
- `package.json`, `tsconfig.base.json`, `biome.json`, `.gitignore`, `.dockerignore`, `.editorconfig`
- `docker-compose.yml`
- `CLAUDE.md`, `README.md`
- `docs/decisions/{README,0001..0013}-*.md`
- `docs/sessions/01-plan.md`
- `packages/{shared,backend,frontend}/package.json`
- `packages/{shared,backend,frontend}/tsconfig.json`
- `packages/{backend,frontend}/Dockerfile`
- `packages/backend/src/{index.ts,index.test.ts,domain/.gitkeep,application/.gitkeep,adapters/http/.gitkeep,adapters/persistence/.gitkeep,main.ts}`
- `packages/frontend/{index.html,vite.config.ts,nginx.conf}`
- `packages/frontend/src/{main.tsx,App.tsx,App.test.tsx,styles.css,domain/.gitkeep,application/.gitkeep,adapters/api/.gitkeep,ui/.gitkeep}`

Plus one external file: `/Users/jacopo.mori/Sites/obsidian/claude/todolist/handoffs/01-handoff.md`.

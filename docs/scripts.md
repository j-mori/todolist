# Scripts

## Daily drivers

| Script | What it does |
|---|---|
| `npm run dev` | Backend `:3000` + Vite `:5173`. Vite proxies `/api` to the backend. |
| `npm run check` | Lint + typecheck + layers + tests + bundle budget. The green-bar gate. |
| `npm run test` | Unit + integration (BE) + component (FE). |
| `npm run test:e2e` | Playwright against the docker-composed stack. |
| `docker compose up --build` | Boot the production-shaped stack (FE on `:8081`, BE on `:3000`). |

## Granular

| Script | What it does |
|---|---|
| `npm run lint` / `npm run format` | Biome. |
| `npm run typecheck` | `tsc --noEmit` per workspace. |
| `npm run check:layers` | `dependency-cruiser` enforces hex-layer imports. |
| `npm run check:bundle-size` | Asserts JS ≤ 110 kB / CSS ≤ 8 kB gzipped. |
| `npm run test:integration` | BE integration suite only. |
| `npm run test:e2e:ui` / `:headed` / `:report` | Playwright variants. |
| `npm run build` | `tsc` + `vite build` per package. |

## Backend env

`packages/backend/src/index.ts` calls `loadConfig(process.env)` and refuses to start if any required variable is missing. See `.env.example` for the canonical list and defaults.

| Variable | Required |
|---|---|
| `PORT`, `DATABASE_PATH`, `CORS_ORIGIN` | yes |
| `MAX_BODY_BYTES`, `LOG_LEVEL`, `NODE_ENV` | no |

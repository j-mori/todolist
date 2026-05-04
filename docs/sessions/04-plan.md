# Session 4 — Frontend Foundations (plan)

## Context

Sessions 1–3 plus the post-Session-3 hardening pass shipped a production-shaped backend on `jacopo.mori/be-hardening` (HEAD `17bb95b`): Hono on `:3000`, `node:sqlite`+Kysely persistence, six use cases over a Zod-validated wire contract in `@todolist/shared`, and a Docker stack on ports `3000` (BE) / `8081` (FE nginx).

The FE is a stub: a single `<App />` saying "scaffold ready", one Vitest, Vite + React 19 + Tailwind v4 wired in `vite.config.ts`. TanStack Query v5 is in `dependencies` but unused.

Session 4's job is **frontend foundations**: hexagonal layout populated, typed API client built against the shared contract, TanStack Query wired, and one read-only `<TaskList />` rendering live data. Mutations are explicitly out of scope — Session 5.

The plan below is concrete enough that the file tree, the API client signature, the test surface and the Docker/dev URL story are all predictable before any code is written.

## Goals & non-goals

| In scope | Out of scope |
|---|---|
| Hexagonal layout under `packages/frontend/src/` populated | Mutations (add / edit / complete / reopen / delete) |
| Typed API client returning `Result<T, ApiClientError>`, parsing responses with shared Zod schemas | Optimistic updates, retries, cache invalidation patterns beyond defaults |
| `useTasksQuery()` hook (TanStack Query v5) | Routing — single screen this session |
| `<TaskList />` screen with loading / empty / populated / error states | Any client-side state library beyond TanStack Query |
| Top-level error boundary surfacing `X-Request-Id` | A11y testing automation (axe etc.) — defer to Session 7 polish |
| Vite dev proxy + nginx prod proxy so FE→BE traffic is same-origin in both envs | Storybook, design system extraction |
| Tailwind v4 design tokens in `theme.css` (light + dark via `prefers-color-scheme`) | Theme switcher UI |
| FE `.env.example` documenting `VITE_API_BASE_URL` | Build-time secret injection |
| Component tests for the four required `<TaskList />` states | E2E (Session 6) |
| Four ADRs (0023–0026) | Editing prior ADRs |

No new runtime deps beyond what's already in `packages/frontend/package.json`. If anything else is needed, the plan revises before writing code.

## Decisions (with rationale)

### D1 — Same-origin via proxy in dev and prod (`/api` path)

The FE never hardcodes `localhost:3000`. In dev, `vite.config.ts` proxies `/api/*` → `http://localhost:3000`. In prod, `nginx.conf` proxies `/api/` → `http://backend:3000/`. Same URL in both environments. CORS becomes irrelevant for the FE container.

Why over the alternatives:
- Hits BE directly + CORS: works, but couples the FE bundle to a hostname/port and exposes a CORS class of bugs (preflights on PATCH/DELETE, header allowlists, dev/prod drift).
- Vite proxy + nginx proxy: zero CORS surface; the bundle ships a relative URL; prod and dev are byte-equivalent paths.

`VITE_API_BASE_URL` defaults to `/api`. Documented in `packages/frontend/.env.example`. Override only for unusual deployments.

The compose `CORS_ORIGIN` for the BE stays at `http://localhost:8081` (already correct for the Docker stack), but the FE container doesn't actually invoke that path — the nginx proxy is server-to-server. The repo-root `.env.example` already lists `CORS_ORIGIN=http://localhost:5173` (Vite default), which keeps non-proxy dev workflows on the table; the proxy strategy makes that fallback "extra credit", not a requirement.

Will be recorded as **ADR-0023**.

### D2 — Wire dates stay strings; format with `Intl` at the UI edge

Task `createdAt` / `updatedAt` are ISO strings on the wire. Three options were considered (kept as strings, parsed at API boundary, transformed in the shared schema). Decision: **keep as strings throughout the FE**.

Why:
- `Intl.DateTimeFormat` and `new Date(s)` both accept ISO strings.
- A `.transform()` in `taskSchema` would force every consumer (BE included) to deal with `Date`, double-parsing on the BE.
- Parsing at the API boundary in the FE only would diverge our wire `Task` type from the in-memory FE `Task` type — silent footgun for query selectors and React keys.

Formatting is centralised in `application/formatting/format-task-timestamp.ts` (one Intl-based function, no date-fns / dayjs dep).

Will be recorded as **ADR-0024**.

### D3 — API client: per-resource object, returns `Result<T, ApiClientError>`, parses responses with shared schemas

Shape: `tasksApi.list()` (this session), `tasksApi.add()` etc. (Session 5). The single `tasksApi` object groups endpoints by resource — easy to type, easy to mock, no stringly-typed routes at call sites.

Every response — success or failure — runs through `errorResponseSchema.safeParse` (on non-2xx) or the endpoint's success schema (`taskListSchema` for list). On schema mismatch the client returns a synthetic `ContractViolation` so a BE drift becomes a *visible runtime failure*, not a broken UI. Cost: zod is in the FE bundle (~12 kB gzip) — already paid because we import schemas from `@todolist/shared`.

Hooks (`useTasksQuery`) unwrap the `Result`: `Ok` → return value to TanStack Query; `Err` → throw a typed `ApiClientError` so React Query treats it as `error` state. Components read `query.error` as `ApiClientError` (typed), not `unknown`.

Will be recorded as **ADR-0025**.

### D4 — A11y baseline (semantic HTML + visible focus + reduced motion + live region) — automation deferred

Manual baseline this session:
- Semantic landmarks: `<header>`, `<main>`, `<ul>`/`<li>` for tasks.
- `<time datetime="…">` for timestamps.
- Visible focus ring via design tokens; never `outline: none`.
- `prefers-reduced-motion` honoured in `theme.css` (no transitions when set).
- `aria-live="polite"` region announces the list size after load and the error message on failure.
- Color contrast via tokens — minimum 4.5:1 body / 3:1 large.

No automated axe tests this session. Adding `vitest-axe` is one line but the brief says "no useless deps" and the screen has very little interactivity yet. Flagged for **Session 7 production polish**.

Will be recorded as **ADR-0026**.

### Other decisions (no ADR — too small)

- **Schema parsing at the FE boundary**: yes, see D3.
- **State management beyond TanStack Query**: none. One screen, server-state-only.
- **Loading/empty/error pattern**: per-component handling in `<TaskList />`. A reusable `<QueryBoundary>` is YAGNI for one screen; document in handoff as a Session 5 candidate when there are 2+ queries.
- **Error boundary**: one top-level class component (`ErrorBoundary` — React 19 still requires class for error boundaries). Renders `<ErrorFallback>` with the latest `X-Request-Id` from the in-flight request, if any. Per-component error states are kept separate (TanStack Query error state ≠ render exception).
- **`X-Request-Id`**: client generates a fresh `crypto.randomUUID()` per request. The BE echoes back. The client surfaces it on `ApiClientError.requestId`. Visible in the UI for failures.
- **Suspense / `use()`**: not adopted yet. `useQuery` (not `useSuspenseQuery`) keeps the test patterns simple and the error story uniform. Switch is reversible.

## File tree (predicted)

```
packages/frontend/
  .env.example                                # NEW — VITE_API_BASE_URL=/api (commented default)
  vite.config.ts                              # MODIFIED — adds server.proxy['/api']
  nginx.conf                                  # MODIFIED — adds location /api/ → backend:3000
  index.html                                  # untouched
  package.json                                # untouched (no new deps)
  vitest.setup.ts                             # untouched
  tsconfig.json                               # untouched

  src/
    main.tsx                                  # MODIFIED — composition root: builds httpClient + tasksApi + QueryClient + provider tree
    styles.css                                # MODIFIED — imports theme.css alongside tailwindcss
    theme.css                                 # NEW — @theme tokens, light+dark, focus ring, reduced-motion

    domain/
      result.ts                               # NEW — Result<T, E> tagged union
      api-error.ts                            # NEW — ApiClientError tagged union, factories, type-guards

    application/
      api-context.tsx                         # NEW — React context: TasksApiProvider + useTasksApi()
      queries/
        task-keys.ts                          # NEW — taskKeys.all, taskKeys.list()
        use-tasks-query.ts                    # NEW — useTasksQuery() hook
      formatting/
        format-task-timestamp.ts              # NEW — Intl-based formatter

    adapters/
      api/
        api-base-url.ts                       # NEW — reads import.meta.env.VITE_API_BASE_URL with default
        http-client.ts                        # NEW — fetch wrapper, request-id, schema-parsed responses
        tasks-api.ts                          # NEW — createTasksApi(httpClient): TasksApi
        http-client.test.ts                   # NEW — unit tests for the wrapper (request-id, error mapping, contract-violation)

    ui/
      App.tsx                                 # MODIFIED — composes <ErrorBoundary><AppShell><TaskList /></>
      AppShell.tsx                            # NEW — header + main layout
      TaskList.tsx                            # NEW — fetches via useTasksQuery; renders states
      TaskList.test.tsx                       # NEW — loading / empty / populated (≥2, ordered) / error
      TaskRow.tsx                             # NEW — single row presentation (pure)
      TaskStatusBadge.tsx                     # NEW — status chip
      ErrorBoundary.tsx                       # NEW — class component
      ErrorFallback.tsx                       # NEW — pure UI for boundary + query error
      LiveRegion.tsx                          # NEW — aria-live wrapper

      App.test.tsx                            # DELETED — superseded by TaskList.test.tsx; kept behaviour ("renders heading") is now covered indirectly

docs/
  decisions/
    0023-frontend-dev-proxy-and-prod-nginx-proxy.md   # NEW
    0024-frontend-wire-dates-as-strings.md            # NEW
    0025-frontend-api-client-shape.md                 # NEW
    0026-frontend-a11y-baseline.md                    # NEW
    README.md                                          # MODIFIED — adds 0023..0026
  sessions/
    04-plan.md                                # NEW — copy of this plan, added in execution phase

CLAUDE.md                                     # MODIFIED — FE layout block becomes concrete; ports table notes /api proxy
```

## Hexagonal layering — what lives where

| Layer | Imports | Forbidden |
|---|---|---|
| `domain/` | `@todolist/shared` (types only) | `application/`, `adapters/`, `ui/`, React |
| `application/` | `domain/`, `@todolist/shared`, `@tanstack/react-query`, React | `adapters/` (uses ports via context) |
| `adapters/api/` | `domain/`, `@todolist/shared` (types + schemas) | `application/`, `ui/`, React |
| `ui/` | `application/`, `domain/`, React, Tailwind classes | `adapters/` directly (always via hooks) |
| `main.tsx` | everything; only file allowed to wire concrete adapters into ports | — |

Mirrors ADR-0013 verbatim.

## API client — verbatim signatures (frozen for Session 5)

```ts
// domain/result.ts
export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E> = Ok<T> | Err<E>;
export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

// domain/api-error.ts
import type { ApiError } from '@todolist/shared';

export type ApiClientError =
  | { kind: 'ValidationError'; field: string; reason: string; status: 400; requestId: string }
  | { kind: 'TaskNotFound';    id: string;                       status: 404; requestId: string }
  | { kind: 'InternalError';                                     status: number; requestId: string }
  | { kind: 'NetworkError';    cause: unknown;                   requestId: string }
  | { kind: 'ContractViolation'; details: string;                requestId: string };

export class ApiClientErrorException extends Error {
  constructor(public readonly error: ApiClientError) { super(`${error.kind} (requestId=${error.requestId})`); }
}

// adapters/api/http-client.ts
import type { ZodType } from 'zod';
import type { Result } from '../../domain/result.ts';
import type { ApiClientError } from '../../domain/api-error.ts';

export interface HttpRequest<T> {
  readonly method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  readonly path: string;                  // e.g. '/tasks' — joined to baseUrl
  readonly body?: unknown;                // JSON-serialised when present
  readonly responseSchema: ZodType<T>;    // validated; mismatch → ContractViolation
}

export interface HttpClient {
  request<T>(req: HttpRequest<T>): Promise<Result<T, ApiClientError>>;
}

export const createHttpClient = (opts: {
  readonly baseUrl: string;                       // e.g. '/api'
  readonly generateRequestId?: () => string;      // default: crypto.randomUUID
  readonly fetchImpl?: typeof fetch;              // default: globalThis.fetch
}): HttpClient;

// adapters/api/tasks-api.ts
import type { TaskList } from '@todolist/shared';
import type { Result } from '../../domain/result.ts';
import type { ApiClientError } from '../../domain/api-error.ts';
import type { HttpClient } from './http-client.ts';

export interface TasksApi {
  list(): Promise<Result<TaskList, ApiClientError>>;
  // Session 5 will extend: add(req), updateTitle(id, req), complete(id), reopen(id), remove(id)
}

export const createTasksApi = (http: HttpClient): TasksApi;

// application/queries/task-keys.ts
export const taskKeys = {
  all: ['tasks'] as const,
  list: () => [...taskKeys.all, 'list'] as const,
} as const;

// application/queries/use-tasks-query.ts
import type { UseQueryResult } from '@tanstack/react-query';
import type { TaskList } from '@todolist/shared';
import type { ApiClientError } from '../../domain/api-error.ts';

export const useTasksQuery = (): UseQueryResult<TaskList, ApiClientError>;

// application/api-context.tsx
import type { ReactNode } from 'react';
import type { TasksApi } from '../adapters/api/tasks-api.ts';

export const TasksApiProvider: (props: { value: TasksApi; children: ReactNode }) => JSX.Element;
export const useTasksApi: () => TasksApi;     // throws if not under provider
```

`useTasksQuery` uses `taskKeys.list()` as the query key. The query function calls `tasksApi.list()`, throws `ApiClientErrorException` on `Err`, returns the value on `Ok`. TanStack Query stores it as `error` (typed via the hook's return) or `data`.

## Dev / prod URL story

| Surface | URL the browser sees | What happens |
|---|---|---|
| Dev (`npm run dev`) | `http://localhost:5173/api/tasks` | Vite proxy strips `/api` and forwards to `http://localhost:3000/tasks`. No CORS preflight. |
| Docker (`docker compose up`) | `http://localhost:8081/api/tasks` | nginx in the FE container proxies to `http://backend:3000/tasks`. No CORS preflight. |
| Override (advanced) | `${VITE_API_BASE_URL}/tasks` | Build-time env baked into the bundle. Documented in `.env.example`. |

`packages/frontend/.env.example`:
```env
# API base URL the FE will append paths to. Defaults to /api which works for both
# `npm run dev` (Vite proxies /api → backend) and `docker compose up` (nginx proxies
# /api/ → backend:3000/). Override only if you serve the FE outside the supported stacks.
# VITE_API_BASE_URL=/api
```

## Component test plan — `<TaskList />`

Run by Vitest + Testing Library + happy-dom. Network mocked at the **fetch boundary** (per the brief), not at TanStack Query.

A `renderTaskList(opts)` helper in the test file:
- builds a fresh `QueryClient` with `retries: false`
- builds a real `httpClient` + real `tasksApi` (so the full client path is exercised)
- wraps in `<TasksApiProvider>` + `<QueryClientProvider>` + `<ErrorBoundary>`
- accepts a `fetchImpl` (defaults to `vi.fn()` set up per test) so `vi.stubGlobal('fetch', …)` is one option but injection is the primary path

Tests, behaviour-first:
1. **shows a loading announcement before data arrives** — the first render with a never-resolving fetch shows the loading state; assert by role (`status` / `progressbar`) and by the live region's content.
2. **announces an empty list when the API returns `[]`** — fetch resolves to `[]`; assert the empty-state copy is rendered and the live region announces it. Asserts: empty state visible, no `<li>` rendered.
3. **renders the user's tasks newest-first** — fetch resolves to two ordered tasks (`['second-task', 'first-task']` per BE ordering); assert both titles render in DOM order, with `<time datetime>` matching the wire `createdAt`, and the status badge reflects the wire `status`. Asserts the *behaviour* (order) not the implementation (no "two `<li>`s exist" tautology).
4. **shows a recoverable error with a request id when the API 500s** — fetch resolves to `{status: 500, body: {error: {kind:'InternalError', requestId:'…'}}}`; assert the error fallback copy renders, contains the requestId from the BE, and is announced via the live region. Bonus: a "Try again" affordance triggers a refetch (just verify the button is rendered + focusable; refetch wiring tested implicitly).

A 5th test on `http-client.ts` (in `http-client.test.ts`, not `TaskList.test.tsx`):
- the client emits `X-Request-Id` from `crypto.randomUUID()` when none provided, and uses the BE's `X-Request-Id` from a 500 response on the resulting error.
- a 200 response whose body fails `taskListSchema.safeParse` becomes a `ContractViolation` `Result.err`.

Layering rule: tests never call `fetch` themselves (other than via the stubbed impl) and never reach into TanStack Query's cache.

## Theme tokens (theme.css)

Tailwind v4 `@theme` block. Minimal:
- `--color-bg`, `--color-surface`, `--color-fg`, `--color-fg-muted`, `--color-border`, `--color-primary`, `--color-danger`, `--color-success`.
- `--radius-sm`, `--radius-md`.
- `--ring-color`, `--ring-width`.
- Light + dark via `@media (prefers-color-scheme: dark)` overriding the same vars.
- `@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }`.
- `*:focus-visible { outline: var(--ring-width) solid var(--ring-color); outline-offset: 2px; }`.

Exposed to Tailwind utilities so `bg-surface`, `text-fg`, `border-border` etc. work in markup.

## Composition root (`main.tsx`)

```ts
const baseUrl = getApiBaseUrl();                        // VITE_API_BASE_URL ?? '/api'
const httpClient = createHttpClient({ baseUrl });
const tasksApi = createTasksApi(httpClient);
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime:    5 * 60_000,
      retry:     1,                                     // BE returns deterministic errors; don't hide them
      refetchOnWindowFocus: true,
    },
  },
});

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <TasksApiProvider value={tasksApi}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </TasksApiProvider>
    </ErrorBoundary>
  </StrictMode>,
);
```

## Verification (definition of done)

```bash
cd /Users/jacopo.mori/Sites/todolist
git checkout -b jacopo.mori/fe-foundations            # branched off 17bb95b on jacopo.mori/be-hardening
# (after execution)

npm install                                            # no new deps; idempotent
npm run check                                          # lint + typecheck + 66 BE tests + Vitest FE suite (≥5 tests)

# Dev workflow — two servers, /api proxy
DATABASE_PATH=./todolist.db npm run dev --workspace @todolist/backend &      # :3000
npm run dev --workspace @todolist/frontend                                    # :5173
# open http://localhost:5173 → empty list (or any tasks created via curl)
curl -fsS -X POST -H 'content-type: application/json' \
  --data '{"title":"hello fe"}' http://localhost:5173/api/tasks                # via Vite proxy
# refresh browser → row visible

# Docker — full stack via nginx /api proxy
docker compose up --build -d
curl -fsS http://localhost:8081/healthz                                       # nginx liveness
curl -fsS http://localhost:8081/api/tasks                                     # via nginx proxy → backend
# open http://localhost:8081 → list renders live data

# Bundle audit (manual once)
npm run build --workspace @todolist/frontend
# inspect packages/frontend/dist/assets/*.js — no occurrences of:
grep -E '(pino|kysely|node:sqlite|@hono/node-server)' packages/frontend/dist/assets/*.js && echo FAIL || echo OK
```

Done when:
- `npm run check` is green.
- Both dev workflows render live BE data in a browser.
- The four `<TaskList />` test cases assert the four behaviours described.
- Keyboard-only focus is visible on every interactive element on the page (there are very few — refresh button, perhaps the heading skip link).
- The FE bundle has none of the BE-only deps (grep above prints `OK`).

## Risks / open questions for the human

1. **Vite `server.proxy` rewrites the path** to drop `/api` so the BE keeps its bare `/tasks` routes (matches the contract). Alternative: extend the BE to mount routes under `/api` so the FE never strips. I'd rather not — the BE stays a clean RESTful service with no proxy assumptions baked in. Flagging.
2. **Bundle audit is manual** this session. A real `vite-bundle-visualizer` step in CI is Session 7 polish. If you want it now, say so.
3. **`vitest-axe` deferred to Session 7.** If the showcase axis demands it earlier, I'll pull it into Session 4 — it's a one-liner.
4. **`useSuspenseQuery` not used.** The hook + boundary pattern is more elegant for showcase, but the testing story diverges. I'd rather not introduce two patterns; stick with `useQuery` everywhere until Session 5 mutations land.
5. **`App.test.tsx` deleted.** Its assertion ("renders heading") survives the deletion of the heading and is otherwise untested. `TaskList.test.tsx` covers what matters. Confirm or push back.

After approval, I will copy this plan verbatim to `docs/sessions/04-plan.md` (per the master plan's per-session-plan convention), then begin executing the file tree above.

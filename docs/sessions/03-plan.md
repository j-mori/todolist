# Session 03 — Plan: Backend Adapters & API

**Owner:** Session 3
**Date:** 2026-05-04
**Branch:** `jacopo.mori/be-adapters` (off `jacopo.mori/be-domain`)
**Touches:** `packages/backend/src/adapters/**`, `packages/backend/src/main.ts`, `packages/backend/src/index.ts`, `packages/backend/test/**` (new), `packages/backend/tsconfig*.json`, `packages/backend/package.json`, `packages/backend/Dockerfile`, `packages/shared/src/**`, `docker-compose.yml`, `docs/decisions/0018..0021`.
**Does NOT touch:** anything under `packages/backend/src/domain/` or `packages/backend/src/application/`. Anything FE.

---

## 1. The HTTP API surface

REST-flavoured, action endpoints for state transitions (rationale in ADR-0018). All responses JSON, content-type set by Hono.

| Method | Path | Use case | Success | Failure modes |
|---|---|---|---|---|
| `GET`    | `/health`              | n/a (kept from Session 1)            | `200` `{status:'ok'}`           | — |
| `GET`    | `/tasks`               | `listTasks`                          | `200` `Task[]`                  | — |
| `POST`   | `/tasks`               | `addTask`                            | `201` `Task` (Location header)  | `400` ValidationError |
| `PATCH`  | `/tasks/:id`           | `updateTask` (title-only)            | `200` `Task`                    | `400` ValidationError, `404` TaskNotFound |
| `POST`   | `/tasks/:id/complete`  | `completeTask`                       | `200` `Task` (always, even if no-op) | `400`, `404` |
| `POST`   | `/tasks/:id/reopen`    | `reopenTask`                         | `200` `Task` (always, even if no-op) | `400`, `404` |
| `DELETE` | `/tasks/:id`           | `deleteTask`                         | `204` No Content                | `400`, `404` |

Notes:
- `PATCH /tasks/:id` is **title-only**. Status changes go through the action endpoints — no `{ title?, status? }` partial-update logic in the HTTP layer (ADR-0018).
- `complete` / `reopen` always return `200 + body` (matches Open Question #3 from Session 2). The FE always learns the canonical task state.
- Header `X-Request-Id` echoed on every response (generated if absent).

### Wire-level `Task` shape

```jsonc
{
  "id":        "550e8400-e29b-41d4-a716-446655440000",  // UUID v4
  "title":     "Buy milk",
  "status":    "pending",                                 // 'pending' | 'completed'
  "createdAt": "2026-05-04T10:00:00.000Z",                // ISO 8601 string
  "updatedAt": "2026-05-04T10:00:00.000Z"
}
```

Date fields go over the wire as ISO strings — JSON has no native date type, and round-tripping `Date` instances is exactly what `JSON.stringify` already does. The Zod schema parses them back into `Date` if needed (FE will mostly leave them as strings).

### Error response envelope (ADR-0020)

```jsonc
// 400
{ "error": { "kind": "ValidationError", "field": "title", "reason": "must not be empty" } }

// 404
{ "error": { "kind": "TaskNotFound", "id": "550e8400-..." } }

// 500 (unexpected)
{ "error": { "kind": "InternalError", "requestId": "01J..." } }
```

The `kind` discriminant matches the domain-error tag verbatim. The FE pattern-matches on `kind` for typed error UIs.

## 2. Request validation

At the HTTP boundary only. Use Zod schemas from `@todolist/shared` — the same schemas the FE will use for request shaping (Section 4).

```ts
addTaskRequestSchema    = z.object({ title: z.string() });
updateTaskRequestSchema = z.object({ title: z.string() });
taskIdParamSchema       = z.object({ id: z.uuid({ version: 'v4' }) });
```

Validation strategy: route handler parses the payload with the shared schema; on failure it short-circuits with a `400` whose `field`/`reason` come from Zod's first issue. **Domain validation (`TaskTitle.from`) still runs** inside the use case — Zod-at-the-edge guards the protocol; domain VOs guard the invariant. Two layers, different responsibilities, no duplication of intent.

## 3. Persistence adapter

`node:sqlite` + Kysely (per ADR-0006). Lives under `packages/backend/src/adapters/persistence/sqlite/`.

### Schema

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('pending', 'completed')),
  created_at TEXT NOT NULL,  -- ISO 8601 with milliseconds
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
```

### Migration strategy (ADR-0021)

The schema is one statement. A migration runner (umzug, kysely-ctl, etc.) is overkill at this size. Instead: **`initSchema(db)` runs the `CREATE TABLE IF NOT EXISTS … ` block synchronously on boot.** Idempotent. When the schema actually evolves (post-Session-3), we revisit. The decision is recorded so a future session doesn't accidentally start running migrations from `n` files without an ADR-cited reason.

### Repository implementation

`createSqliteTaskRepository(db: Kysely<TaskDb>): TaskRepository` translates between `Task` (domain) and `TasksRow` (DB). Row → domain via `Task.restore({ id: TaskId.unsafe(row.id), title: TaskTitle.unsafe(row.title), status: row.status, createdAt: new Date(row.created_at), updatedAt: new Date(row.updated_at) })`.

We need `TaskTitle.unsafe` for the same reason `TaskId.unsafe` exists — the row was already validated on the way in. **This adds a new method to `TaskTitle`.** Not a refactor of domain rules, just an escape hatch. Will note in handoff and the relevant test.

`save` uses Kysely's `onConflict('id').doUpdateSet({...})` for upsert semantics matching the port contract.

### DB lifecycle

- Production: file at `process.env.DATABASE_PATH ?? '/data/todolist.db'`. Container mounts `todolist-data` volume on `/data`.
- Tests: `:memory:` per test (each integration test gets a fresh DB; nothing carries between them).
- `dispose()`: `db.destroy()` → closes the underlying SQLite handle. Composition root returns it for the integration suite to call.

## 4. API contract export (ADR-0019)

`@todolist/shared` becomes the single source of truth for the wire contract. Layout:

```
packages/shared/src/
  contract/
    task.ts        # taskSchema + Task type
    requests.ts    # addTaskRequestSchema, updateTaskRequestSchema, taskIdParamSchema
    errors.ts      # validationErrorSchema, taskNotFoundSchema, internalErrorSchema, errorResponseSchema
  index.ts         # re-exports everything
```

```ts
// example: contract/task.ts
import { z } from 'zod';
export const taskStatusSchema = z.enum(['pending', 'completed']);
export const taskSchema = z.object({
  id: z.uuid({ version: 'v4' }),
  title: z.string().min(1).max(200),
  status: taskStatusSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Task = z.infer<typeof taskSchema>;     // wire-level: dates as strings
export type TaskStatus = z.infer<typeof taskStatusSchema>;
```

Why Zod schemas and not hand-written types? Because (a) they're already required for runtime validation on the BE, and (b) `z.infer` types are derived from the same source — drift is impossible by construction. The FE imports **types** (`type Task`); Zod runtime is tree-shaken when only types are used. (`@todolist/shared` declares zod as a dependency so both BE and FE see a single resolution.)

`@todolist/shared` keeps its existing `package.json` exports field that points at `src/index.ts` for both `types` and `default`. We add `zod` to its dependencies (it currently has none).

## 5. Composition root

```ts
// packages/backend/src/main.ts
export type ComposeOptions = { databasePath: string; logger?: Logger };
export type ComposedApp = { app: Hono; dispose: () => Promise<void> };
export const compose = (opts: ComposeOptions): ComposedApp => { /* … */ };
```

Wires:

```ts
const db = new Database(opts.databasePath);
initSchema(db);
const kysely = new Kysely<TaskDb>({ dialect: new SqliteDialect({ database: db }) });
const tasks  = createSqliteTaskRepository(kysely);
const clock  = { now: () => new Date() };
const ids    = { next: () => TaskId.unsafe(crypto.randomUUID()) };
const app    = createApp({ tasks, clock, ids, logger: opts.logger });
return { app, dispose: () => kysely.destroy() };
```

`createApp(deps)` is the only thing the routes module exports; it builds the Hono instance, registers middlewares (request-id, logger, error mapper) and mounts the routes module with the deps closed over.

`index.ts` (server entrypoint, very small):

```ts
const log = pino({ name: 'todolist-backend' });
const port = Number.parseInt(process.env.PORT ?? '3000', 10);
const databasePath = process.env.DATABASE_PATH ?? '/data/todolist.db';
const { app, dispose } = compose({ databasePath, logger: log });
const server = serve({ fetch: app.fetch, port }, (info) => log.info({ port: info.port }, 'listening'));
const shutdown = async (signal: string) => { log.info({ signal }, 'shutting down');
                                              server.close(); await dispose(); process.exit(0); };
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
```

The single `compose` factory makes the integration suite trivial: it gets the same `app` and `dispose` the production server gets.

## 6. Logging

- One Pino logger created in `index.ts`, passed into `compose` and from there into `createApp`.
- Hono middleware: per-request log line `{ method, path, status, latency_ms, request_id }` at `info` level on success, `warn` on 4xx, `error` on 5xx.
- The pre-existing `app.use('*', logger())` (Hono's text logger) is **removed** — we have structured logs now and don't need both.
- `request-id` middleware reads `X-Request-Id` (clients can correlate) or generates `crypto.randomUUID()`; sets it on the response and on the per-request `Variables` map so the logger middleware can include it.

## 7. Error mapping

A single `respondWith<T, E>(c: Context, result: Result<T, E>, successStatus: ContentfulStatusCode)` helper centralises the mapping. One switch, all routes use it. Avoids the "every handler hand-rolls 400/404" smell.

```ts
ValidationError → 400 with { error: { kind, field, reason } }
TaskNotFound    → 404 with { error: { kind, id } }
```

Plus a top-level `app.onError` that catches anything thrown from a handler:
```ts
500 with { error: { kind: 'InternalError', requestId } }   // logged as error with stack
```

## 8. Integration test strategy

> Real Hono, real Kysely, real `node:sqlite` (`:memory:`). No port-level mocks. Each test gets its own composed app via `compose({ databasePath: ':memory:' })` and disposes it on teardown.

Layout (matches the prompt's `packages/backend/test/integration/`):

```
packages/backend/test/integration/
  _helpers.ts                     # spawn/dispose helper, JSON helper
  health.api.test.ts              # GET /health survives the wiring change
  tasks.api.test.ts               # full lifecycle for every endpoint
  request-id.api.test.ts          # X-Request-Id echo and generation
  error-mapping.api.test.ts       # malformed JSON → 400, internal throw → 500 + logged
```

What the integration tests assert (each one a behaviour):

- `POST /tasks` with `{title:'a'}` → `201`, body validates against `taskSchema`, `Location: /tasks/{id}` header, and `GET /tasks` returns it.
- `POST /tasks` with `{title:'   '}` → `400` with `{error:{kind:'ValidationError',field:'title'}}`.
- `POST /tasks` with `{}` → `400` (Zod-level missing field).
- `GET /tasks` returns tasks in `createdAt desc` order — seed three with controlled timestamps via the API, assert order.
- `PATCH /tasks/:id` happy path → updated body, `updated_at > created_at` (assert with millisecond resolution by waiting >= 1ms or by checking inequality via the timestamps the server reports).
- `PATCH /tasks/<random uuid>` → `404`.
- `PATCH /tasks/not-a-uuid` → `400`.
- `POST /tasks/:id/complete` happy path → `200`, status `completed`. Calling again → `200`, status still `completed`, **same `updatedAt` as the first call** (proves the no-op-skip-save path through to the wire).
- `POST /tasks/:id/reopen` mirrors complete, `pending → completed → pending`.
- `DELETE /tasks/:id` happy path → `204`, body empty, `GET /tasks/:id` (n/a — no GET-by-id endpoint) but `GET /tasks` no longer contains it.
- `DELETE /tasks/<random uuid>` → `404`.
- Persistence: across two calls within the same composed app, state survives (it's `:memory:` per app, so this proves data round-trips through SQLite, not just lives in JS).
- Request id: caller sends `X-Request-Id: abc` → response echoes `abc`. No header → response has a valid UUID v4.
- Malformed JSON body → `400` (not a 500 from a thrown parse error).
- Forced internal error (we'll add a one-off test route or trigger via dependency injection in a single test) → `500` with `{error:{kind:'InternalError',requestId:...}}` and a `pino` log line at error level. *(If injecting a fault makes the test convoluted, we'll skip the manufactured-500 test and rely on the smaller unit-level test of the error mapper.)*

Helpers:
```ts
// _helpers.ts
export const startApi = () => {
  const { app, dispose } = compose({ databasePath: ':memory:' });
  return {
    request: (path: string, init?: RequestInit) => app.request(path, init),
    dispose,
  };
};
```

`node:test` doesn't have built-in `before/after` lifecycle helpers as visible as Jest; we'll use `t.after(() => api.dispose())` per test to keep them isolated. Pattern:
```ts
test('GET /tasks returns the seeded tasks', async (t) => {
  const api = startApi();
  t.after(() => api.dispose());
  // … use api.request …
});
```

## 9. Folder layout

```
packages/backend/
  src/
    adapters/
      http/
        app.ts                       # createApp({ tasks, clock, ids, logger? })
        respond.ts                   # respondWith helper
        request-id.ts                # request-id middleware
        request-logger.ts            # structured per-request logger
        error-handler.ts             # app.onError → 500 envelope
        routes/
          tasks.ts                   # all /tasks routes
        # NB: collocated unit tests for these go right next to the file as *.test.ts
      persistence/
        sqlite/
          db.ts                      # opens node:sqlite, builds Kysely instance
          schema.ts                  # initSchema(db) — idempotent CREATE TABLE
          task-row.ts                # rowToTask / taskToRow
          task-repository.ts         # createSqliteTaskRepository
          task-repository.test.ts    # collocated unit-ish test against in-memory db
    main.ts                          # compose()
    index.ts                         # entrypoint (already exists, will shrink)
  test/
    integration/
      _helpers.ts
      health.api.test.ts
      tasks.api.test.ts
      request-id.api.test.ts
      error-mapping.api.test.ts
  tsconfig.json                      # used by `typecheck`; includes src + test
  tsconfig.build.json                # used by `npm run build`; includes src only

packages/shared/
  src/
    contract/
      task.ts
      requests.ts
      errors.ts
    index.ts
  package.json                       # adds zod as a dep
```

### Test config split

Today's `packages/backend/tsconfig.json` has `"rootDir": "./src"` + `"include": ["src/**/*.ts"]`. To typecheck `test/` without breaking `npm run build`, we split:

- `tsconfig.build.json` — extends base, `rootDir: ./src`, `include: ['src/**/*.ts']`, excludes tests. Used by `"build": "tsc -p tsconfig.build.json"`.
- `tsconfig.json` — extends base, `noEmit: true`, includes both `src/**/*.ts` and `test/**/*.ts`, excludes `*.test.ts` and `*.test-support.ts` for emit (irrelevant since noEmit) but includes them for checking. Used by `"typecheck": "tsc --noEmit"`.

This is the cheapest configuration that gives us both correctness (build is restricted) and dev confidence (typecheck covers tests). One ADR (0021 covers it as part of test-strategy follow-up; otherwise an inline comment in the tsconfig is enough).

## 10. ADRs to write

- **ADR-0018** — REST design: action endpoints (`POST /tasks/:id/complete`, `…/reopen`) over PATCH-with-status; `PATCH /tasks/:id` is title-only. Status codes per route. Always-200-with-body for idempotent state transitions.
- **ADR-0019** — API contract location: Zod schemas in `@todolist/shared/contract`, FE imports types only. `zod` becomes a `@todolist/shared` runtime dependency.
- **ADR-0020** — Error response envelope `{ error: { kind, ... } }` matching domain `kind` tags.
- **ADR-0021** — Persistence: schema initialised idempotently on boot via `CREATE TABLE IF NOT EXISTS …`; no migration runner until schema changes after Session 3.

(Test-config split is documented inline in `tsconfig.json` + the build script, not a standalone ADR — too plumbing-y.)

## 11. Docker & compose changes

- `packages/backend/Dockerfile`: add `RUN mkdir -p /data && chown -R node:node /data` before `USER node`. Set `ENV DATABASE_PATH=/data/todolist.db`.
- `docker-compose.yml`: declare a named volume `todolist-data` and mount it at `/data` on the backend service. Add `DATABASE_PATH: /data/todolist.db` to the backend env block (already implicit via Dockerfile but explicit is friendlier).

## 12. Execution order

1. Branch `jacopo.mori/be-adapters` off `jacopo.mori/be-domain`. Verify `npm run check` is still green.
2. Add `TaskTitle.unsafe` (one-line addition + one assertion test). Required by the persistence row→domain mapping; doesn't change validation semantics.
3. `@todolist/shared` contract module + zod dep.
4. Persistence adapter, with a small collocated test (not the integration suite — quicker feedback loop while building).
5. HTTP layer: `respond`, `request-id`, `request-logger`, `error-handler`, `routes/tasks.ts`, then expand `app.ts`.
6. `main.ts` composition root.
7. Tsconfig split + `package.json` script tweaks.
8. Integration tests, behaviour by behaviour.
9. Dockerfile + compose tweaks. `docker compose up --build` smoke test.
10. ADRs 0018–0021 + index update.
11. CLAUDE.md script-table tweak (new `test:integration` if added; new `build` invocation).
12. `npm run check` green. `docker compose up --build` healthy, `curl` smoke. Handoff.

## 13. Known divergences from the prompt

The prompt's "Definition of done" says **"All five use cases reachable via HTTP."** Session 2 added a sixth (`reopenTask`, per the user's amendment). I'll cover all six and note the discrepancy in the handoff; not raising as an open question — it's a strict superset.

## 14. Resolved questions (decided per "best software design practice")

1. **Contract package exports schemas AND types.** Both are exported from `@todolist/shared`. BE uses schemas for runtime validation; FE imports types by default (zero runtime cost — `z.infer` is type-only) and may opt into the schemas if it wants belt-and-braces client-side validation. Single source of truth is the principle; tree-shaking handles the trade-off.
2. **`TaskTitle.unsafe` is added.** Symmetric to `TaskId.unsafe` — adapters reading already-validated rows shouldn't pay re-validation cost. One assertion test pins the contract.
3. **`DELETE /tasks/:id` returns 404 if the task is unknown.** REST idempotency is about *retries producing the same outcome*, not "always return 204". The use case already surfaces `TaskNotFound`; honouring it as 404 gives the FE the "stale state" signal.
4. **No `GET /tasks/:id`.** Not in any use case, not in the brief, FE can render from the list. YAGNI. Trivial to add later if Session 4 needs it.
5. **CORS configured now.** Hono `cors()` middleware in `createApp`, allowing `http://localhost:8081` by default (the FE host port from Session 1), overridable via `CORS_ORIGIN` env (comma-separated for multiple origins). Unblocks Session 4 without any FE-side workarounds.

## 15. Definition of done

- All six use cases reachable via the documented HTTP surface.
- `@todolist/shared` exports the contract; FE-ready.
- Integration suite green (`node --test 'test/**/*.test.ts'`) and passes against `:memory:` SQLite.
- `npm run check` green (lint + typecheck across all workspaces + unit + integration tests).
- `docker compose up --build` brings the backend healthy. `curl -fsS -X POST -H 'content-type: application/json' --data '{"title":"smoke"}' http://localhost:3000/tasks` returns a 201; restart the container, `curl http://localhost:3000/tasks` still shows it (proves volume mount works).
- Handoff with the full API surface table, schema export paths, and Docker/local instructions.

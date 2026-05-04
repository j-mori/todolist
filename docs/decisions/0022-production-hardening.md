# ADR-0022: Production hardening — explicit configuration, required deps, security middleware

**Status:** accepted
**Date:** 2026-05-04
**Session:** 03 (post-review hardening)

## Context
A code review of Session 3's adapter wiring surfaced a cluster of "production-ready in name, not in fact" issues: hardcoded defaults inside production code, optional dependencies that mask real requirements, a `node:sqlite` adapter using SQL-string sniffing where statement metadata exists, fragile timestamp-ordering tests that rely on real sleeps, and several missing pieces of HTTP hygiene (security headers, body size limit, readiness probe, awaited shutdown).

None of the individual issues were structural — but together they constituted a significant gap between "the tests pass" and "this could run in production". This ADR records the principles that the cleanup applied so future sessions don't reintroduce the same shapes.

## Decision

**Configuration is loaded once, explicitly, at the entrypoint.**

A new `src/config.ts` exports `loadConfig(env: NodeJS.ProcessEnv): Config`. It validates every required variable (`PORT`, `DATABASE_PATH`, `CORS_ORIGIN`) and refuses to start with a precise `ConfigError` if anything is missing or malformed. Optional values (`MAX_BODY_BYTES`, `LOG_LEVEL`, `NODE_ENV`) carry explicit, documented defaults. **No defaults inside production code paths** — the entrypoint is the only place fallback values are allowed, and they are documented in `.env.example`.

**`createApp` and `compose` accept all dependencies explicitly. None are optional.**

Previously, `createApp({ logger?, corsOrigin? })` silently fabricated a silent pino logger and defaulted CORS to `http://localhost:8081`. Both implied a contract the rest of the stack didn't know about. Both are now required. The single point that *can* fall back is the entrypoint, which sources defaults from `Config`. Tests pass real (silenced) loggers; integration helpers compose with `:memory:` SQLite and a deterministic `FixedClock` + `SequentialIdGenerator`.

**Single composition root: `compose(deps)`.**

`compose(deps)` is the only composition function. It takes every port and returns the wired app — no defaults, no construction logic.

A small adapter helper, `openWiredDatabase(path)`, encapsulates the SQLite-specific work (open the handle, run `initSchema`, build the `TaskRepository`, expose a readiness probe and a `dispose`). Both the production entrypoint (`index.ts`) and the integration test helper call `openWiredDatabase` and pass its `repo` + `readiness` into `compose`. The "production defaults" — `productionClock`, `productionIdGenerator` — are exported constants the entrypoint passes explicitly; tests pass `FixedClock` and `SequentialIdGenerator` instead.

This is the standard composition-root pattern (Seemann) with the production wiring inlined into the entrypoint rather than wrapped in a second factory. One concept, two call sites.

**Use cases share validated-id loading via `loadTaskById`.**

`update`/`complete`/`reopen`/`delete` previously each repeated the "validate id → look up → 404" prelude. A single `loadTaskById(rawId, tasks)` helper replaces it. Use cases shrink to "transition" code; the helper is the only place that knows about `TaskId.from` + `taskNotFound`.

**HTTP routes parse via Result-shaped helpers.**

`parseIdParam(c)` and `parseJsonBody(c, schema)` return `Result<T, ValidationError>`, removing the previous `INVALID_JSON` symbol sentinel and the per-route Zod-issue unpacking. Routes are now ~5 lines each.

**Response helpers are intent-named.**

`respondOk` / `respondCreated` / `respondNoContent` / `respondValidationError` replace the previous `respondWithTask(c, r, 201)` shape. Route handlers no longer pass magic status codes.

**The persistence adapter consults statement metadata, not SQL strings.**

`isReaderSql` (a SQL-prefix string match) is replaced by `stmt.columns().length > 0`. Robust against CTEs, RETURNING clauses, and any future query Kysely emits.

**Schema invariants live in one place.**

`TASK_TITLE_MAX_LENGTH` and `TASK_TITLE_MIN_LENGTH` are exported from `@todolist/shared` and imported by the domain `TaskTitle` value object. The wire schema and the domain VO cannot disagree by construction.

**`unsafe` value-object constructors are not part of the public API.**

`TaskId.unsafe` and `TaskTitle.unsafe` are gone. Their place is taken by:
- `Task.restore(rawRow)` — the persistence boundary's controlled re-hydration.
- `mintTaskId(rawUuidV4)` — exposed in `domain/task/task-id-mint.ts` for IdGenerator implementations only.

The "trust me, this is already valid" assertion is colocated with the trust boundary, and is named accordingly.

**HTTP hygiene additions:**
- `secureHeaders()` middleware (Hono built-in) for X-Content-Type-Options, X-Frame-Options, Referrer-Policy, etc.
- `bodyLimit(maxBytes)` middleware enforcing `Content-Length` against `MAX_BODY_BYTES`. Requests without `Content-Length` on POST/PATCH are rejected.
- `/healthz` (liveness, no I/O) and `/readyz` (queries the DB via `SELECT 1`). `/health` kept as a back-compat alias.
- `server.close()` in shutdown is awaited via `promisify`. Disposal happens after in-flight requests complete.
- `uncaughtException` and `unhandledRejection` log fatally and exit with code 1.
- Pino redaction config covers `password`, `token`, `authorization` keys defensively.

**Tests assert behaviour, deterministically.**

Every `await wait(N)` call in the integration suite is gone — replaced by `api.clock.advance(N)`. Error-response assertions use `expectApiError(res, kind)`, which validates against `errorResponseSchema` from `@todolist/shared` and returns the narrowed payload. Inline error-shape interfaces are gone — schema drift is now a test failure.

Two new test files cover the previously-uncovered paths:
- `error-mapping.api.test.ts` — exercises `app.onError` (500 envelope) by composing with a deliberately-throwing repository, plus the body-limit 413 path.
- `security-headers.api.test.ts` — pins the secureHeaders defaults that matter most.

Plus a `task-row.test.ts` for the persistence boundary mapping, a `Task.restore` test, and a shared `task.test-support.ts` fixture (`idOf`/`titleOf`/`taskOf` + `TASK_IDS`) consumed by every test file that previously rolled its own.

## Consequences

- **Positive:** No hidden defaults in production code. Any required configuration that's missing is a startup-time error, not a "works in dev, breaks in prod" surprise. Tests are deterministic and free of `wait()`. The persistence adapter's only workaround (SQL-prefix sniffing) is gone. Domain integrity is enforced by the absence of public escape hatches. Route handlers, use cases, and integration tests all consume the `Result` vocabulary uniformly.
- **Trade-off:** Two compose entry points (`compose` + `composeProduction`) instead of one. The split is justified — it's the standard "pure wiring vs. production defaults" pattern — and the test surface gets cleaner as a result.
- **Follow-up:** A linter or `dependency-cruiser` rule preventing imports of `__unsafeTaskId` / `__unsafeTaskTitle` outside `domain/task/` would belt-and-brace the trust boundary; defer to Session 7's hex-layering enforcement work.

## Alternatives considered

- **Defaults stay in code, a doc explains them** — rejected: defaults in code make `node index.js` "work" on the wrong machine; the brief asks for production-ready, which means failing fast on misconfiguration.
- **Single `compose(opts)` with everything optional** — rejected: would force every test to opt out of production wiring it doesn't want; the split makes intent explicit.
- **Keep the `unsafe` exports, document they're internal** — rejected: docs don't enforce; the underscore-prefixed module-level symbol is the convention this codebase already uses for "do not import from outside".

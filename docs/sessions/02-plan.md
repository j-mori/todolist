# Session 02 — Plan: Backend Domain (TDD core)

**Owner:** Session 2
**Date:** 2026-05-04
**Branch:** `jacopo.mori/be-domain` (off `jacopo.mori/scaffold`)
**Touches:** `packages/backend/src/domain/**`, `packages/backend/src/application/**`, `packages/backend/tsconfig.json` (one-line exclude), `docs/decisions/0014..0017`.
**Does NOT touch:** `adapters/`, `main.ts`, `index.ts`, `packages/shared/**`, anything FE.

---

## 1. Aggregate boundary

One aggregate — **`Task`** — is enough for the brief (view / add / update / complete / delete). No sub-aggregates. Adding `Priority`, `DueDate`, `Tags`, `Subtasks` would be scope creep against the assignment.

`Task` shape (immutable record):

| Field       | Type        | Notes                                                       |
|-------------|-------------|-------------------------------------------------------------|
| `id`        | `TaskId`    | branded UUID v4 string                                      |
| `title`     | `TaskTitle` | branded non-empty trimmed string, ≤ 200 chars               |
| `status`    | `TaskStatus`| `'pending' \| 'completed'`                                  |
| `createdAt` | `Date`      | set by `Clock` port at creation, never mutates              |
| `updatedAt` | `Date`      | set by `Clock` port on every state change                   |

`createdAt` enables stable sorting (newest first by default — cheap, predictable, what the UI will want). `updatedAt` is needed for ETag/If-Match in Session 3 and for "recently updated" UX hints later.

Behaviour lives on the entity, not in services:

- `Task.create({ id, title, now })` → `Task` (status defaults to `'pending'`).
- `task.withTitle(newTitle, now)` → `Task` (returns a new instance with updated title + `updatedAt`).
- `task.complete(now)` → `Task` (idempotent: if already completed, returns the **same** instance — `updatedAt` is *not* advanced when nothing changed; documented in ADR-0014).

No setters, no mutation. All transitions go through these methods so invariants are checked in one place.

## 2. Value objects

Smart constructors return `Result<T, ValidationError>` — never throw.

### `TaskId` (`domain/task/task-id.ts`)
- Branded `string`.
- `TaskId.from(input)` validates UUID v4 with a Zod schema; returns `Result<TaskId, ValidationError>`.
- `TaskId.unsafe(input)` — escape hatch for adapters reading already-validated DB rows; documented and tested for refusal of obviously bad shapes (still parses).
- Equality: structural (string compare).

### `TaskTitle` (`domain/task/task-title.ts`)
- Branded `string`.
- `TaskTitle.from(input)` trims, then validates `1..=200` chars. Returns `Result`.
- Rejects: empty, whitespace-only, > 200 chars (after trim).
- Decision recorded in **ADR-0015 (input normalisation: trim before validate)**.

### `TaskStatus` (`domain/task/task-status.ts`)
- `type TaskStatus = 'pending' | 'completed'`.
- No brand — the union itself is the type, Zod schema mirrors it.
- Helpers: `TaskStatus.isCompleted(s)`, `TaskStatus.isPending(s)`.

No `CreatedAt` / `UpdatedAt` value objects — `Date` is sufficient and Zod can validate `instanceof Date` at the HTTP boundary in Session 3. Branding timestamps is ceremony for no behaviour.

## 3. Use cases

One file each, under `application/use-cases/`. Each is a pure function returning `Promise<Result<…, …>>`. Dependencies are passed in (no DI container — it's the brief).

```ts
// application/use-cases/add-task.ts
export type AddTaskInput = { title: string };
export type AddTaskDeps  = { tasks: TaskRepository; clock: Clock; ids: IdGenerator };
export type AddTaskError = ValidationError;
export const addTask = (input: AddTaskInput, deps: AddTaskDeps)
  : Promise<Result<Task, AddTaskError>>
```

| Use case        | Input                       | Errors                                                         | Behaviour                                                                                 |
|-----------------|-----------------------------|----------------------------------------------------------------|-------------------------------------------------------------------------------------------|
| `addTask`       | `{ title }`                 | `ValidationError`                                              | Validates title → mints id via `ids.next()` → builds `Task` with `clock.now()` → `tasks.save`. |
| `listTasks`     | `()`                        | none (`Result<Task[], never>` collapses to `Task[]`)           | Returns all tasks sorted by `createdAt` desc (newest first).                              |
| `updateTask`    | `{ id, title }`             | `ValidationError \| TaskNotFound`                              | Validates id + title, loads via repo, applies `withTitle`, saves.                         |
| `completeTask`  | `{ id }`                    | `ValidationError \| TaskNotFound`                              | Validates id, loads, calls `complete(now)`, saves only if status actually changed.        |
| `reopenTask`    | `{ id }`                    | `ValidationError \| TaskNotFound`                              | Symmetric to `completeTask`: marks `completed → pending`, idempotent (no save if no-op).  |
| `deleteTask`    | `{ id }`                    | `ValidationError \| TaskNotFound`                              | Validates id, loads (to surface 404), then `tasks.delete(id)`.                            |

**Listing order:** `createdAt desc`. Predictable for tests, sensible for users. Recorded as a one-liner in the use-case docstring; not worth its own ADR.

**Reopen flow:** added `reopenTask` (Option A from the post-plan amendment) so the brief's "Update a task (e.g., mark as completed)" works in both directions. Symmetric to `completeTask`: idempotent, skips save if status didn't change. Mirrored on the entity as `task.reopen(now)`.

## 4. Repository port

The single port adapters will implement in Session 3. Lives at `application/ports/task-repository.ts`:

```ts
import type { Task } from '../../domain/task/task.ts';
import type { TaskId } from '../../domain/task/task-id.ts';

export type TaskRepository = {
  save(task: Task): Promise<void>;            // upsert
  findById(id: TaskId): Promise<Task | null>; // null = not found, never throws for absence
  list(): Promise<Task[]>;                    // all tasks, repo decides default order; use case re-sorts deterministically
  delete(id: TaskId): Promise<void>;          // idempotent: deleting a missing id is OK; use case surfaces 404 by checking first
};
```

Two more tiny ports keep the use cases deterministic and pure:

```ts
// application/ports/clock.ts
export type Clock = { now(): Date };

// application/ports/id-generator.ts
export type IdGenerator = { next(): TaskId };
```

Why ports for `Clock` and `IdGenerator`? Because (a) the domain forbids `node:crypto` and `Date.now()` directly (per the handoff: no `node:` imports in domain), and (b) tests need determinism without `vi.mock` shenanigans. Recorded in **ADR-0016 (deterministic dependencies as ports)**.

## 5. Error model

**Decision: typed `Result<T, E>` discriminated union, plus tagged-union domain errors.** No exceptions across layer boundaries. Throw only for programmer errors (e.g. assertion failures inside smart constructors that should be unreachable).

```ts
// domain/shared/result.ts
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
export const ok  = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
```

```ts
// domain/task/errors.ts
export type ValidationError = { kind: 'ValidationError'; field: string; reason: string };
export type TaskNotFound    = { kind: 'TaskNotFound';    id: string };
export type DomainError     = ValidationError | TaskNotFound;
```

Why `Result` over throwing:
1. **Type system enforces handling.** A caller of `addTask` cannot ignore `ValidationError` — it shows up in the return type.
2. **Cheap to map at the HTTP boundary.** Session 3 will pattern-match `error.kind` to status codes (`ValidationError → 400`, `TaskNotFound → 404`). With exceptions we'd need a global error-mapping middleware that re-discovers types via `instanceof`.
3. **Aligns with CLAUDE.md** ("Errors as typed values at the domain layer; throw only for programmer errors").

Recorded in **ADR-0017 (Result + tagged-union errors over exceptions)**.

## 6. Folder layout

Matches ADR-0013. `*.test.ts` and `*.test-support.ts` are excluded from the build via `tsconfig.json` (we'll add the second exclude).

```
packages/backend/src/
  domain/
    shared/
      result.ts
      result.test.ts
    task/
      errors.ts
      task.ts
      task.test.ts
      task-id.ts
      task-id.test.ts
      task-title.ts
      task-title.test.ts
      task-status.ts
      task-status.test.ts
  application/
    ports/
      clock.ts
      id-generator.ts
      task-repository.ts
    use-cases/
      add-task.ts
      add-task.test.ts
      list-tasks.ts
      list-tasks.test.ts
      update-task.ts
      update-task.test.ts
      complete-task.ts
      complete-task.test.ts
      reopen-task.ts
      reopen-task.test.ts
      delete-task.ts
      delete-task.test.ts
    test-support/
      in-memory-task-repository.test-support.ts   # implements the port; lives next to use cases
      fixed-clock.test-support.ts
      sequential-id-generator.test-support.ts
```

Test-support files use the `*.test-support.ts` suffix so they're excluded from `tsc` output (one-line `tsconfig.json` change). They're plain TypeScript modules — `node --test` can import them like any other file.

## 7. Test strategy

Every test asserts an **observable behaviour** that would silently disappear if the production code were deleted or mistuned. No "constructor returns the right type" tests — that's typecheck's job. No coverage targets.

### Result helpers (`result.test.ts`)
- `ok(v)` → `{ ok: true, value: v }`.
- `err(e)` → `{ ok: false, error: e }`.
- Type narrowing: when `r.ok === true`, `r.value` is accessible without `as`. (Compile-time test via a function body — fails to compile if narrowing breaks.)

### `TaskId`
- Accepts a valid UUID v4.
- Rejects empty / non-UUID / wrong-version (e.g. v1) → `ValidationError` with `field: 'id'`.
- Two `TaskId.from(sameUuid)` produce structurally equal values.

### `TaskTitle`
- Accepts a trimmed non-empty string up to 200 chars.
- Trims surrounding whitespace before validating ("  hi  " → "hi", valid).
- Rejects empty, whitespace-only, > 200 chars (after trim) → `ValidationError` with `field: 'title'` and a distinct `reason` per case.

### `TaskStatus`
- `isPending('pending')` true; `isCompleted('completed')` true; opposite false.
  *(Cheap to write, fails if someone "simplifies" the helpers.)*

### `Task` entity
- `Task.create` produces a pending task with the supplied id, title, and timestamps from `now`.
- `task.withTitle(newTitle, now)` returns a new instance, advances `updatedAt`, leaves `createdAt` untouched.
- `task.complete(now)` on a pending task → completed, `updatedAt` advanced.
- `task.complete(now)` on an already-completed task → identity (same reference, `updatedAt` unchanged) — proves idempotence and protects against accidental "touch updatedAt on every save" bugs.
- `task.reopen(now)` on a completed task → pending, `updatedAt` advanced.
- `task.reopen(now)` on an already-pending task → identity (idempotent).

### Use cases (one test file each, fakes from `test-support/`)

`addTask`:
- happy path → returns `ok` with task; repo received exactly one `save` for that task; `ids.next` called once; `clock.now` called at least once.
- invalid title → returns `err` with `ValidationError`; **repo not called**.

`listTasks`:
- empty repo → `[]`.
- multiple tasks → returned in `createdAt desc` order regardless of repo's insertion order.

`updateTask`:
- happy path → title updated, `updatedAt` advanced, repo got `save`.
- task missing → `err({ kind: 'TaskNotFound' })`.
- invalid new title → `err({ kind: 'ValidationError' })`; repo's `save` **not** called.

`completeTask`:
- pending → completed, repo got `save`.
- already completed → `ok` with the same task; repo's `save` **not** called (proves idempotence + skip-on-no-change).
- task missing → `err({ kind: 'TaskNotFound' })`.

`reopenTask`:
- completed → pending, repo got `save`.
- already pending → `ok`, repo's `save` **not** called.
- task missing → `err({ kind: 'TaskNotFound' })`.

`deleteTask`:
- existing task → `ok`; repo's `delete` called once.
- missing → `err({ kind: 'TaskNotFound' })`; repo's `delete` **not** called.

### Test support

`InMemoryTaskRepository`: backed by a `Map<TaskId, Task>`. Exposes `saveCount`, `deleteCount` (or whatever's needed) for the assertions above. **Will be reused by Session 3 integration tests.**

`FixedClock`: returns a fixed `Date`; `advance(ms)` mutates it for sequence assertions.

`SequentialIdGenerator`: deterministic UUIDs (`'00000000-0000-4000-8000-000000000001'`, …`002`, …) — easier to read in test failures than random UUIDs.

### Total expected count

~28–32 tests. Every one earns its keep.

## 8. ADRs to write

- **ADR-0014** — `Task` aggregate shape & invariants (one-aggregate-only, immutable record, behaviour on entity).
- **ADR-0015** — Title normalisation: trim before validate; max length 200.
- **ADR-0016** — Determinism via ports (`Clock`, `IdGenerator`) instead of `Date.now` / `crypto.randomUUID`.
- **ADR-0017** — `Result<T, E>` + tagged-union errors over thrown exceptions.

Plus an entry per ADR in `docs/decisions/README.md`.

## 9. Execution order (TDD)

1. Branch off, verify scaffold green (`npm run check`).
2. `result.ts` + tests.
3. `task-id`, `task-title`, `task-status` + tests, in that order.
4. `errors.ts`, then `task.ts` + tests.
5. Ports (`clock`, `id-generator`, `task-repository`).
6. Test-support fakes.
7. Use cases in the order listed in §3, red → green → refactor each.
8. Write the four ADRs.
9. `npm run check` green.
10. Write `obsidian/.../handoffs/02-handoff.md`.

## 10. Open questions for the user

1. ~~**Reopen flow.**~~ **Resolved (post-plan amendment, option A):** `reopenTask` added as a sixth use case, symmetric to `completeTask`.
2. **Title length cap.** I'm picking 200 chars by fiat (long enough for any real task, short enough to keep the UI honest). Speak up if you want a different number — easy to change, but it'll be tested.
3. **`TaskId.unsafe` escape hatch.** Needed for Session 3's persistence adapter (it'll read pre-validated UUIDs from SQLite and shouldn't pay for re-validation). Confirm this is acceptable; the alternative is forcing the adapter through the validating constructor and eating the perf hit.

## 11. Definition of done (matches prompt)

- Domain package has zero runtime deps beyond Node built-ins (Zod stays — it's a runtime dep but not a Node built-in; ADR-0004 already accepts this).
- Each use case has ≥1 happy-path test and ≥1 test per meaningful failure mode.
- Test names readable as a behavioural spec.
- `npm run check` green.
- Handoff written.

# ADR-0014: `Task` aggregate shape and invariants

**Status:** accepted
**Date:** 2026-05-04
**Session:** 02

## Context
The brief lists four user-facing capabilities (view / add / update / delete, with "mark as completed" called out as the canonical update). It says nothing about priority, due dates, tags, subtasks, or assignees. A "showcase" repo can be tempted to model more than the brief requires; we resist.

## Decision
A single aggregate, **`Task`**, with five immutable fields:

| Field       | Type        | Notes                                                   |
|-------------|-------------|---------------------------------------------------------|
| `id`        | `TaskId`    | branded UUID v4 string                                  |
| `title`     | `TaskTitle` | branded non-empty trimmed string, ≤ 200 chars           |
| `status`    | `TaskStatus`| `'pending' \| 'completed'`                              |
| `createdAt` | `Date`      | set at creation, never mutates                          |
| `updatedAt` | `Date`      | advances on every state change                          |

Behaviour lives on the entity, not in services or use cases:

- `Task.create({ id, title, now })` — defaults `status` to `'pending'`, sets both timestamps to `now`.
- `task.withTitle(title, now)` — returns a new instance with the new title and an advanced `updatedAt`.
- `task.complete(now)` — pending → completed, advances `updatedAt`. Idempotent on already-completed: returns the **same instance**, `updatedAt` does **not** advance.
- `task.reopen(now)` — completed → pending, advances `updatedAt`. Idempotent on already-pending: same instance, no advance.

No setters. No mutation. All transitions go through these methods so invariants are enforced in one place.

## Consequences
- **Positive:** Domain has no I/O, no constructors that throw, and no "modify in place" footguns. Use cases become tiny — they orchestrate, not transform. The same-instance-on-no-op guarantee enables a cheap "save only if changed" pattern in use cases, which we use in `completeTask` and `reopenTask`.
- **Trade-off:** Returning the same reference on a no-op is a behavioural API choice that callers must respect; it is documented and tested, but a careless refactor could break it.
- **Follow-up:** Session 3's persistence adapter must rebuild a `Task` from a row; we expose `Task.restore(fields)` for that purpose, bypassing the create-time invariants (timestamps come from the DB, not the clock).

## Alternatives considered
- **Anaemic record + service functions** — rejected: scatters invariants, makes a "complete a completed task touches updatedAt" bug invisible.
- **Class with private setters** — rejected: TS/JS classes pull in `this`-binding hazards and ceremony with no benefit over a closed factory returning a frozen-shaped object.
- **Adding `priority`, `dueDate`, etc.** — rejected: scope creep against the assignment.

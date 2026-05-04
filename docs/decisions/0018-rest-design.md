# ADR-0018: REST design — action endpoints, status codes, idempotent semantics

**Status:** accepted
**Date:** 2026-05-04
**Session:** 03

## Context
The domain layer (Session 2) ships six use cases: `addTask`, `listTasks`, `updateTask`, `completeTask`, `reopenTask`, `deleteTask`. Two HTTP shapes can carry them:

1. **Pure REST/PATCH** — `PATCH /tasks/:id` with a partial body `{ title?, status? }` covers update+complete+reopen.
2. **REST + RPC actions** — `PATCH /tasks/:id` for title only; `POST /tasks/:id/complete` and `POST /tasks/:id/reopen` for state transitions.

Either is defensible. The trade-offs are concrete: shape 1 has fewer endpoints; shape 2 has 1:1 alignment with use cases and avoids partial-update plumbing in the HTTP layer.

## Decision
**Shape 2 — RPC-style action endpoints alongside a single-field PATCH.** The full surface:

| Method | Path | Use case | Success | Notes |
|---|---|---|---|---|
| `GET`    | `/health`              | n/a                  | `200 {status:'ok'}`    | kept from Session 1 |
| `GET`    | `/tasks`               | `listTasks`          | `200 Task[]`           | sorted `createdAt desc` server-side |
| `POST`   | `/tasks`               | `addTask`            | `201 Task`             | `Location: /tasks/:id` header |
| `PATCH`  | `/tasks/:id`           | `updateTask`         | `200 Task`             | title-only |
| `POST`   | `/tasks/:id/complete`  | `completeTask`       | `200 Task` (always)    | idempotent — body returned even on no-op |
| `POST`   | `/tasks/:id/reopen`    | `reopenTask`         | `200 Task` (always)    | idempotent — body returned even on no-op |
| `DELETE` | `/tasks/:id`           | `deleteTask`         | `204 No Content`       | `404` if id is unknown |

Failure mapping is centralised in `respond.ts`: `ValidationError → 400`, `TaskNotFound → 404`, anything thrown → `500` via `app.onError`.

Idempotent transitions (`complete`, `reopen`) **always return `200 + body`**, even when the use case decided not to persist a change (no-op skip). The client always learns the canonical state. We considered `204 No Content` for the no-op case but rejected it: the client would have to perform a follow-up `GET` to render the result, and the discriminator between "no-op" and "applied" leaks server-side optimisation into the wire contract.

`DELETE` returns `404` (not the always-`204` "REST is idempotent" reading) because the `TaskNotFound` signal is genuinely useful UX — it tells the client they're operating on stale state. REST idempotency is about *retries returning the same outcome*, not "always 204".

## Consequences
- **Positive:** Each use case maps to exactly one route handler; no partial-update logic in the adapter. Adding a new transition (e.g. `archiveTask`) is a new POST endpoint, not a schema change to PATCH.
- **Trade-off:** Two extra endpoints over a single-PATCH design. Acceptable; the "purity" cost is negligible against the clarity gained.
- **Follow-up:** If we ever need to update title and status atomically (we don't today), revisit this ADR.

## Alternatives considered
- **`PATCH /tasks/:id` with `{ title?, status? }`** — rejected: forces partial-update plumbing in the HTTP layer (decoding "is this a status change or a title change?"), and an idempotent state transition becomes a partial PATCH with one field, which obscures intent.
- **`PUT /tasks/:id` (full replacement)** — rejected: punishes the client for not knowing all fields; not how a small task UI thinks about edits.
- **Always `204` on `DELETE`** — rejected: drops the `TaskNotFound` signal that the client UX wants.
- **`204` on no-op `complete`/`reopen`** — rejected: introduces a meaningless distinction in the wire and forces clients to follow up with `GET`.

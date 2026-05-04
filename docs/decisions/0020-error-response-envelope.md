# ADR-0020: Error response envelope `{ error: { kind, ... } }`

**Status:** accepted
**Date:** 2026-05-04
**Session:** 03

## Context
ADR-0017 established that the domain returns errors as tagged unions. The HTTP adapter has to translate them onto the wire. The shape choice has surprisingly long-running consequences: any client that catches an HTTP error will pattern-match on whatever we ship today.

Common shapes:

1. **`{ error: { kind, ... } }`** — discriminated by `kind`, mirrors the domain.
2. **RFC 7807 `application/problem+json`** — `{ type, title, status, detail, instance }`. Mature, generic, verbose for our needs.
3. **Bare error fields** — `{ error: 'TaskNotFound', id: '...' }`. Saves nesting; weaker discrimination.

## Decision
**Option 1.** All error responses share a single envelope:

```jsonc
// 400
{ "error": { "kind": "ValidationError", "field": "title", "reason": "must not be empty" } }
// 404
{ "error": { "kind": "TaskNotFound", "id": "550e8400-..." } }
// 500
{ "error": { "kind": "InternalError", "requestId": "01J..." } }
```

The `kind` field is a `z.discriminatedUnion('kind', [...])` so FE narrowing is precise:

```ts
import { type ApiError, errorResponseSchema } from '@todolist/shared';
const parsed = errorResponseSchema.parse(await res.json());
switch (parsed.error.kind) {
  case 'ValidationError':  /* parsed.error.field, parsed.error.reason */
  case 'TaskNotFound':     /* parsed.error.id */
  case 'InternalError':    /* parsed.error.requestId */
}
```

The status code (`400` / `404` / `500`) is not duplicated inside the body — HTTP already carries it. The `kind` adds the semantic discriminator the protocol layer doesn't have.

`requestId` on `InternalError` lets a user grepping logs cross-reference a specific failure. Same id is on the `X-Request-Id` response header on every response.

## Consequences
- **Positive:** Discriminator matches domain `kind` verbatim — there's exactly one vocabulary across the whole stack. FE error handling is type-safe via the discriminated union schema. The `requestId` on 500s makes "it failed, here's the id" tickets trivially actionable.
- **Trade-off:** Not RFC 7807-compliant. We lose some interop with generic HTTP problem libraries. Acceptable: this is a self-contained app and 7807 is verbose for our needs.
- **Follow-up:** Session 4's typed FE client should `errorResponseSchema.parse()` on non-2xx responses and surface the discriminated union to React components.

## Alternatives considered
- **RFC 7807** — rejected: heavyweight; `type` URLs are made-up for an internal API; we'd ship our own discriminator alongside `type` anyway.
- **Bare fields** — rejected: weaker discrimination, and "is `error` a string or an object?" type ambiguity grows over time.
- **Multiple envelopes per error class** — rejected: makes the FE write N parsers instead of 1.

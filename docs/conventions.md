# Conventions

The rules. Most are mechanically enforced; the rest live here so review can be cheap.

## Code

- **No `any`.** No `// @ts-expect-error` without a linked issue or ADR.
- **Imports use `.ts` extensions** (Node 24 strip mode).
- **Two-space indent, single quotes, trailing commas, 100-char line.** Biome enforces it.
- **Comments only when explaining a non-obvious *why*.** Never *what*.

## Errors

- **Errors are typed values** at the domain layer: `Result<T, DomainError>` with a tagged-union `kind`.
- **`throw` is for programmer errors only.** Anything a caller might recover from goes in the return type.
- See [ADR-0013](adrs/0013-architecture-result-over-exceptions.md).

## Layering

| Layer | May import | Must not import |
|---|---|---|
| `domain/` | Node built-ins, Zod | `application/`, `adapters/` |
| `application/` | `domain/` | `adapters/` |
| `adapters/` | `application/` ports + `domain/` types | the reverse |
| `main.ts` | everything | (it's the composition root) |

Enforced by `npm run check:layers` ([ADR-0012](adrs/0012-architecture-hexagonal-layout.md)).

## Tests

- A test must fail if its target behaviour breaks. Otherwise delete it.
- Mock at the right boundary: `fetch` for FE component tests; nothing for BE integration tests.
- No `data-testid`, no `await wait`, no `waitForTimeout`, no `it.skip` in main.
- Per-layer scope: [`docs/testing.md`](testing.md).

## Git

- Pre-commit runs Biome on staged files via `lefthook` ([ADR-0016](adrs/0016-architecture-lefthook-pre-commit.md)).
- No `--no-verify` without a reason in the commit body.
- Decisions go in an [ADR](adrs/), not a commit message.

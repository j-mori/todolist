# ADR-0032: `dependency-cruiser` enforces the hex-layer import rules

**Status:** accepted
**Date:** 2026-05-05
**Session:** 07

## Context

ADR-0013 fixed the hexagonal folder layout per package: `domain/` → `application/` → `adapters/` → composition root, with imports flowing in one direction only. Until Session 7 the rule was enforced by review discipline alone — Biome v2 has no first-class `no-restricted-imports`-across-folders rule, and the Biome plugin API is still in flight. ADR-0022 also asked for a defensive ban on the `__unsafe*` persistence-boundary symbols outside `domain/task/`, again with no enforcement. Both are flagged as "Session 7" follow-ups in `CLAUDE.md` and the ADR-0022 consequences section.

The choice space was three options:
1. Wait for Biome to ship a layered import-restriction rule.
2. Hand-roll a small AST walker as a script.
3. Adopt a focused tool that already does it.

Waiting gives no signal today. A hand-rolled walker is fine until it isn't (regex over imports lies; an AST walker means picking and maintaining a parser). A focused tool makes the boundary visible and self-documenting.

## Decision

Use **`dependency-cruiser`** (v17), with a config at `.dependency-cruiser.cjs` that encodes the rules as `forbidden` entries. A `npm run check:layers` script wraps the invocation, and `npm run check` and the GitLab CI `layers` job both depend on it.

Rules:

- BE `domain/` cannot import from `application/` or `adapters/`.
- BE `application/` cannot import from `adapters/`.
- BE `adapters/` cannot import from anything inside `src/` outside `application/`, `domain/`, or other `adapters/` siblings (and `@todolist/shared`).
- FE `domain/` cannot import from `application/`, `adapters/`, or `ui/`.
- FE `application/` cannot import from `adapters/` or `ui/`.
- FE `adapters/` cannot import from `ui/`.
- Any module outside `packages/backend/src/domain/task/` is forbidden from importing a symbol whose path matches `__unsafe[A-Z]` (the persistence-boundary escape hatches from ADR-0022).
- A `no-circular` rule errors on cycles; a `no-orphans` rule warns on unused modules (with explicit allow-listed exceptions for ports and entry points that are reached through type-only imports).

Tests, test-helpers, and the `packages/e2e/` workspace are excluded from the analysis — they intentionally cross layers (a test must touch the thing it tests). The rules apply to the production graph that the bundler and runtime walk.

`packages/shared` is a leaf contract module with no internal layers, so it is not analysed. `packages/e2e` is a black-box test workspace.

## Consequences

- **Positive:** The known gap is closed. A layer violation is a CI failure, not a review nit. `__unsafe*` escape hatches are now mechanically scoped to where they are allowed. The rules read as a single `.cjs` file — easier to evolve than 10 review comments.
- **Trade-off:** One more dev-dep (`dependency-cruiser`) and one more cache to warm in CI. The tool is mature and stable; revisit only if its maintenance burden grows.
- **Follow-up:** None pinned. If Biome ships a comparable rule in v3, evaluate then — but switching is cheap, and the config maps almost 1:1.

## Alternatives considered

- **Wait for Biome plugins** — rejected: no signal today, no committed timeline, and the rules described above are tabular enough that a second tool is fine.
- **Hand-rolled AST walker** — rejected: every parser shift (TS upgrades, new syntax) becomes a maintenance task. `dependency-cruiser` already tracks the TS resolver.
- **ESLint with `import/no-restricted-paths`** — rejected: would re-introduce ESLint just for this, after ADR-0010 deliberately consolidated on Biome.
- **Just keep doing review discipline** — rejected: Session 7 is the polish session; reviewable conventions should be enforced, not aspirational.

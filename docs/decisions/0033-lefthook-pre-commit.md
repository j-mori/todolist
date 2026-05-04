# ADR-0033: `lefthook` for pre-commit hooks (biome on staged files)

**Status:** accepted
**Date:** 2026-05-05
**Session:** 07

## Context

The project's stated north star is "state-of-the-art TypeScript in 2026" and that includes the developer experience. The cheap-and-fast feedback for "what landed in this commit?" is a pre-commit hook. Without one, `npm run check` runs in CI minutes after the push and the engineer is already on the next thing — a Biome formatting error becomes a back-and-forth instead of a no-op.

The choice space:
1. Husky — the JS-incumbent. Node-only, requires Node to run hooks.
2. lefthook — Go binary, no runtime dependency, parallel command execution.
3. pre-commit — Python-based, configured in YAML, used widely outside the JS world.
4. Native `core.hooksPath` + a shell script — zero-dep but every change is manual on every machine.

Husky and lefthook converge functionally; the differentiator is that lefthook starts faster (no Node spinup), runs commands in parallel by default, and the YAML is shorter than Husky's package.json + per-hook script split. pre-commit would mean introducing Python to a TS-only repo. Hand-rolled hooks lose the per-machine consistency.

## Decision

Use **lefthook** (v2). Configuration lives at `lefthook.yml` at the repo root. A single `pre-commit` block runs `biome check --write` on staged files and re-stages anything Biome auto-fixed. `npm install` runs `lefthook install` via the `prepare` script so the hook is wired the moment a contributor clones and installs.

```yaml
pre-commit:
  parallel: true
  commands:
    biome:
      glob: '*.{ts,tsx,js,jsx,mjs,cjs,json,jsonc,css}'
      run: npx biome check --write --no-errors-on-unmatched --files-ignore-unknown=true {staged_files}
      stage_fixed: true
```

**No pre-push hook.** The full `npm run check` builds the FE bundle and is too slow (~12s) to put on every push; CI is the green-bar gate. Engineers who want it can add it locally without touching `lefthook.yml`.

`git commit --no-verify` remains technically usable (every git hook honours it). The repo convention forbids it without an explicit reason in the commit body — see `CLAUDE.md`. The hook config is small enough that bypassing for "this one Biome warning" is laziness, not pragmatism.

## Consequences

- **Positive:** Formatting violations are auto-corrected on commit, never reach review. `npm install` wires the hook automatically — no per-machine "did you run `husky install`" trap. The `prepare` script swallows installation errors with `|| true` so a missing lefthook binary on first install never blocks the install itself; the hook just isn't active.
- **Trade-off:** lefthook is one more binary to install (Go, ~7 MB). It comes via npm so the install is invisible to contributors who already run `npm install`.
- **Follow-up:** None. The Biome step is the right balance of "fast enough to run on every commit" and "covers >90% of churn-causing nits".

## Alternatives considered

- **Husky + lint-staged** — rejected: two tools where lefthook is one; the JS-runtime hook startup is measurably slower; the config splits between `package.json` + `.husky/`.
- **pre-commit (Python)** — rejected: would introduce Python to a TS-only repo. Excellent tool, wrong fit.
- **Hand-rolled `core.hooksPath`** — rejected: every machine needs the manual `git config` step; PRs that change the hook never propagate.
- **No hook at all** — rejected: the showcase brief is "2026 DX". A repo without a pre-commit hook in 2026 is incomplete.

# ADR-0010: Biome for lint and format

**Status:** accepted
**Date:** 2026-05-04
**Session:** 01

## Context
The historical default — ESLint + Prettier — pulls in ~10 packages, two binaries, two configs, and slow CI passes. **Biome** is a single Rust binary that does both, configured via one `biome.json`, faster by an order of magnitude. **Oxlint** is faster still but lint-only (still need a formatter). Lint enforcement of hexagonal import boundaries is on Biome's roadmap but not yet first-class — gap acknowledged.

## Decision
Use **`@biomejs/biome` v2** as the only lint+format tool. Single config at `biome.json` enables `recommended` rules, organises imports as an assist action, and pins formatter style (single quotes, trailing commas, 100-char line, 2-space indent). The root `npm run lint` runs `biome lint .`; `npm run format` runs `biome format --write .`.

## Consequences
- **Positive:** One dep replaces five+. Faster than ESLint+Prettier by 10–20×. Single config to reason about. Built-in import organisation.
- **Trade-off:** No first-class plugin for hexagonal-layering import bans (an ESLint-restricted-imports analogue). Gap captured in `CLAUDE.md`; revisit in Session 7 with a custom Biome plugin or a `dependency-cruiser` companion.
- **Follow-up:** Session 7 — evaluate Biome plugin API for layering rule, or add `dependency-cruiser` as a CI-only check.

## Alternatives considered
- **ESLint 9 + Prettier** — rejected: slower, more deps, more config surface, no upside for our rule needs.
- **Oxlint** — rejected: lint-only; would still need a formatter.
- **deno fmt + deno lint** — rejected: we're not in a Deno runtime; mismatched ergonomics.

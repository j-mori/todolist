# ADR-0002: Node 24 LTS as the runtime

**Status:** accepted
**Date:** 2026-05-04
**Session:** 01

## Context
The brief requires Node 24+. We must pick between **24 (active LTS through April 2027)** and **26 (current, released Oct 2026, LTS in April 2027)**. The repo is a "production-ready showcase" — predictability of behaviour and tooling parity (Playwright base images, Alpine images, npm) outranks a few extra months of bleeding-edge built-ins.

## Decision
Pin **Node 24 LTS** for both local development and Docker images (`node:24-alpine`). Engines field in root `package.json` declares `>=24.0.0`. `@types/node` pinned to the matching `^24` line.

## Consequences
- **Positive:** Stable `node:sqlite`, native TS type-stripping (`--experimental-strip-types`), `node --run`, `node --watch`, `node:test`, permission model — all present and shipping. Maximal compatibility with downstream container ecosystems.
- **Trade-off:** Misses a handful of Node 26-only refinements (e.g. updated `node:sqlite` features). Acceptable.
- **Follow-up:** Bump to Node 26 once it enters LTS (April 2027) and Playwright/Alpine images publish a stable matrix.

## Alternatives considered
- **Node 26 (current)** — rejected: not LTS yet; tooling parity (Docker images, Playwright) lags by weeks.
- **Bun / Deno** — rejected: brief explicitly names Node; sticking with Node also keeps the testing built-ins (`node:test`) and the production runtime story honest.
